import { useState } from 'react';

// ─── Setup Wizard Step ────────────────────────────────────────────────────────
//
// Rendered in the 'auth' slot of the setup wizard.
// Props: { onNext, initialData, addLog, setupStatus }

function GoogleAuthSetupStep({ onNext, initialData, addLog, setupStatus }) {
  const [form, setForm] = useState({
    appName: setupStatus?.appName || 'dokku-manager',
    dokkuHost: setupStatus?.dokkuHost || '',
    clientId: initialData?.clientId || '',
    clientSecret: '',
    callbackUrl: initialData?.callbackUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const derivedCallbackUrl = form.dokkuHost && !form.callbackUrl
    ? `https://${form.appName}.${form.dokkuHost}/api/auth/callback`
    : form.callbackUrl;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    addLog('Saving Google OAuth credentials...');

    const callbackUrl = form.callbackUrl || derivedCallbackUrl;

    try {
      const res = await fetch('/api/setup/auth-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId: form.clientId,
          clientSecret: form.clientSecret,
          callbackUrl,
          appName: form.appName,
          dokkuHost: form.dokkuHost || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save credentials');

      addLog('Google OAuth credentials saved', 'success');
      onNext({ clientId: form.clientId, callbackUrl });
    } catch (err) {
      addLog(`Failed: ${err.message}`, 'error');
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const callbackPreview = form.callbackUrl || derivedCallbackUrl;

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-1">Google OAuth</h2>
      <p className="text-gray-600 text-sm mb-5">
        Create an OAuth 2.0 credential in{' '}
        <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong>,
        then paste the values below. Add the callback URL as an authorized redirect URI.
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dokku App Name
            </label>
            <input
              type="text"
              value={form.appName}
              onChange={set('appName')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="dokku-manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dokku Host (domain)
            </label>
            <input
              type="text"
              value={form.dokkuHost}
              onChange={set('dokkuHost')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              placeholder="dokku.example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Google Client ID
          </label>
          <input
            type="text"
            value={form.clientId}
            onChange={set('clientId')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            placeholder="123456789-abc...apps.googleusercontent.com"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Google Client Secret
          </label>
          <input
            type="password"
            value={form.clientSecret}
            onChange={set('clientSecret')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            placeholder="GOCSPX-..."
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Callback URL
          </label>
          <input
            type="url"
            value={form.callbackUrl}
            onChange={set('callbackUrl')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            placeholder={derivedCallbackUrl || 'https://dokku-manager.example.com/api/auth/callback'}
          />
          {callbackPreview && (
            <p className="text-xs text-gray-500 mt-1">
              Add <code className="bg-gray-100 px-1 rounded">{callbackPreview}</code> as an authorized redirect URI in Google Cloud Console.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !form.clientId || !form.clientSecret}
          className="w-full py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}

// ─── Settings Section ─────────────────────────────────────────────────────────
//
// Rendered in the 'auth' tab of Server Settings.
// Props: { serverConfig, appConfig, managerAppName, fetchConfig }

function GoogleAuthSettings({ appConfig, managerAppName, fetchConfig }) {
  const isClientIdSet = !!appConfig?.GOOGLE_CLIENT_ID;
  const isSecretSet = !!appConfig?.GOOGLE_CLIENT_SECRET;
  const isCallbackSet = !!appConfig?.GOOGLE_CALLBACK_URL;
  const isConfigured = isClientIdSet && isSecretSet && isCallbackSet;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ clientId: '', clientSecret: '', callbackUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const startEdit = () => {
    setForm({
      clientId: appConfig?.GOOGLE_CLIENT_ID || '',
      clientSecret: '',
      callbackUrl: appConfig?.GOOGLE_CALLBACK_URL || '',
    });
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!managerAppName) return;
    setSaving(true);
    setError(null);
    try {
      const vars = {};
      if (form.clientId) vars.GOOGLE_CLIENT_ID = form.clientId;
      if (form.clientSecret) vars.GOOGLE_CLIENT_SECRET = form.clientSecret;
      if (form.callbackUrl) vars.GOOGLE_CALLBACK_URL = form.callbackUrl;

      if (Object.keys(vars).length === 0) {
        setError('No changes to save');
        return;
      }

      const res = await fetch(`/api/${encodeURIComponent(managerAppName)}/config`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars, noRestart: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setEditing(false);
      await fetchConfig();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Google OAuth</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Sign in with Google accounts. Credentials from Google Cloud Console.
          </p>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            disabled={!managerAppName}
            className="btn btn-secondary btn-sm"
          >
            {isConfigured ? 'Edit' : 'Configure'}
          </button>
        )}
      </div>

      <div className="p-4">
        {!editing ? (
          <dl className="space-y-3 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700 w-36">Status:</dt>
              <dd>
                {isConfigured
                  ? <span className="badge badge-green">Configured</span>
                  : <span className="badge badge-gray">Not Configured</span>
                }
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700 w-36">Client ID:</dt>
              <dd className="font-mono text-xs text-gray-600">
                {isClientIdSet ? appConfig.GOOGLE_CLIENT_ID : <span className="text-gray-400">not set</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700 w-36">Client Secret:</dt>
              <dd className="text-gray-600">
                {isSecretSet ? '••••••••••••••••' : <span className="text-gray-400">not set</span>}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-gray-700 w-36">Callback URL:</dt>
              <dd className="font-mono text-xs text-gray-600 break-all">
                {isCallbackSet ? appConfig.GOOGLE_CALLBACK_URL : <span className="text-gray-400">not set</span>}
              </dd>
            </div>
            {!managerAppName && (
              <p className="text-xs text-amber-600">
                Config changes require the app to be deployed on Dokku.
              </p>
            )}
          </dl>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Client ID
              </label>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                className="input font-mono text-sm"
                placeholder="123456789-abc...apps.googleusercontent.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Client Secret
              </label>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                className="input font-mono text-sm"
                placeholder={isSecretSet ? '(leave empty to keep existing)' : 'GOCSPX-...'}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Callback URL
              </label>
              <input
                type="url"
                value={form.callbackUrl}
                onChange={(e) => setForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                className="input font-mono text-sm"
                placeholder="https://dokku-manager.example.com/api/auth/callback"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must match an authorized redirect URI in Google Cloud Console.
                Changing this requires an app restart.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
                disabled={saving || !managerAppName}
                className="btn btn-primary btn-sm"
              >
                {saving ? 'Saving...' : 'Save (no restart)'}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Config is saved without an immediate restart. Restart the app manually
              for changes to take effect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plugin export ────────────────────────────────────────────────────────────

export default {
  id: 'google-auth',

  setupWizardSteps: [
    {
      id: 'google-auth-setup',
      slot: 'auth',
      title: 'Google OAuth',
      description: 'Configure Google Sign-In credentials',
      component: GoogleAuthSetupStep,
      order: 0,
    },
  ],

  settingsSections: [
    {
      id: 'google-auth-settings',
      label: 'Google OAuth',
      tab: 'auth',
      tabLabel: 'Authentication',
      tabOrder: 10,
      component: GoogleAuthSettings,
      order: 0,
    },
  ],
};
