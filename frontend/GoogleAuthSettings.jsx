import { useState } from 'react';

export default function GoogleAuthSettings({ appConfig, managerAppName, fetchConfig }) {
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
