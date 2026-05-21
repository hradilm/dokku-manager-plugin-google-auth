import { useState } from 'react';

export default function GoogleAuthSetupStep({ onNext, initialData, addLog, setupStatus }) {
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
