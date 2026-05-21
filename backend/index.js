// Google OAuth 2.0 auth provider plugin for dokku-manager.
//
// Required env vars on the Dokku app:
//   GOOGLE_CLIENT_ID      — from Google Cloud Console → OAuth 2.0 credentials
//   GOOGLE_CLIENT_SECRET  — from Google Cloud Console → OAuth 2.0 credentials
//   GOOGLE_CALLBACK_URL   — must match an authorized redirect URI in GCC,
//                           e.g. https://dokku-manager.example.com/api/auth/callback

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const CACHE_TTL = 30_000;

function register(ctx) {
  const dokku = ctx.host.dokku;

  let cfgCache = null;
  let cfgCacheTime = 0;

  ctx.registerSensitiveKey('GOOGLE_CLIENT_SECRET');

  ctx.registerAuthProvider({
    id: 'google',
    label: 'Google',

    // Positional mapping used by POST /api/setup/auth-provider to write the
    // right env var names from the generic wizard body fields.
    configKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'],

    async readConfig() {
      if (cfgCache && Date.now() - cfgCacheTime < CACHE_TTL) return cfgCache;
      try {
        const config = await dokku.getConfig(dokku.appName);
        cfgCache = {
          clientId: config.GOOGLE_CLIENT_ID || '',
          clientSecret: config.GOOGLE_CLIENT_SECRET || '',
          callbackUrl: config.GOOGLE_CALLBACK_URL || '',
        };
        cfgCacheTime = Date.now();
        return cfgCache;
      } catch {
        return cfgCache || { clientId: '', clientSecret: '', callbackUrl: '' };
      }
    },

    clearCache() {
      cfgCache = null;
      cfgCacheTime = 0;
    },

    isConfigured(cfg) {
      return !!(cfg.clientId && cfg.clientSecret && cfg.callbackUrl);
    },

    getAuthUrl(cfg) {
      const params = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: cfg.callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
      });
      return `${GOOGLE_AUTH_URL}?${params}`;
    },

    async exchangeCode(cfg, code) {
      const body = new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.callbackUrl,
        grant_type: 'authorization_code',
      });

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error_description || data.error || 'Google token exchange failed');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        expiresIn: data.expires_in || 3600,
      };
    },

    async getUserProfile(accessToken) {
      const res = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Google user profile (${res.status})`);
      }

      const data = await res.json();
      return {
        id: data.sub,
        email: data.email,
        name: data.name || data.email,
        picture: data.picture,
      };
    },

    async refreshToken(cfg, token) {
      const body = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: token,
        grant_type: 'refresh_token',
      });

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error_description || 'Google token refresh failed');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || token,
        expiresIn: data.expires_in || 3600,
      };
    },
  });
}

module.exports = { register };
