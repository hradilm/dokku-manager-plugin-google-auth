// Tests for GoogleAuthSettings rendered inside the Extensions tab.
// Requires the full app to be running (see playwright.config.js).
import { test, expect } from '@playwright/test';

const APP_NAME = 'dm-test';

function mockServerConfig(page) {
  return page.route('/api/server-config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ appName: APP_NAME, dokkuHost: 'test.example.com' }),
    })
  );
}

function mockAppConfig(page, config = {}) {
  return page.route(`/api/apps/${APP_NAME}/config`, (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
  });
}

function mockExtensionsWithGoogle(page, { isConfigured = false } = {}) {
  return page.route('/api/extensions/active', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authProviders: [{ id: 'google', label: 'Google Auth', isConfigured, configKeys: [] }],
        dnsProviders: [],
        activeAuthProviderId: 'google',
        activeDnsProviderId: null,
        plugins: [],
      }),
    })
  );
}

async function goToExtensions(page) {
  await page.route('/api/setup/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ setupComplete: true }) })
  );
  await page.goto('/settings/extensions');
  await page.waitForSelector('[class*="animate-spin"]', { state: 'detached', timeout: 10_000 }).catch(() => {});
}

test.describe('GoogleAuthSettings — view state', () => {
  test('shows Not Configured badge and Configure button when credentials absent', async ({ page }) => {
    await mockServerConfig(page);
    await mockAppConfig(page, {});
    await mockExtensionsWithGoogle(page, { isConfigured: false });
    await goToExtensions(page);

    await expect(page.getByText('Not Configured').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configure' })).toBeVisible();
    await expect(page.getByText('not set').first()).toBeVisible();
  });

  test('shows Configured badge, Edit button, and values when all keys present', async ({ page }) => {
    await mockServerConfig(page);
    await mockAppConfig(page, {
      GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_CALLBACK_URL: 'https://manager.example.com/api/auth/callback',
    });
    await mockExtensionsWithGoogle(page, { isConfigured: true });
    await goToExtensions(page);

    await expect(page.getByText('Configured').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByText('123.apps.googleusercontent.com')).toBeVisible();
    await expect(page.getByText('https://manager.example.com/api/auth/callback')).toBeVisible();
    await expect(page.getByText('••••••••••••••••')).toBeVisible();
  });

  test('shows amber notice and disabled Configure button without managerAppName', async ({ page }) => {
    await page.route('/api/server-config', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ appName: null }) })
    );
    await page.route('/api/apps/**/config', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
    );
    await mockExtensionsWithGoogle(page, { isConfigured: false });
    await goToExtensions(page);

    await expect(page.getByText(/Config changes require the app to be deployed/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configure' })).toBeDisabled();
  });
});

test.describe('GoogleAuthSettings — edit form', () => {
  test.beforeEach(async ({ page }) => {
    await mockServerConfig(page);
    await mockExtensionsWithGoogle(page, { isConfigured: false });
  });

  test('pre-fills client ID and callback URL but leaves secret empty', async ({ page }) => {
    await mockAppConfig(page, {
      GOOGLE_CLIENT_ID: '123.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'existing-secret',
      GOOGLE_CALLBACK_URL: 'https://manager.example.com/api/auth/callback',
    });
    await mockExtensionsWithGoogle(page, { isConfigured: true });
    await goToExtensions(page);

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByLabel('Google Client ID')).toHaveValue('123.apps.googleusercontent.com');
    await expect(page.getByLabel('Callback URL')).toHaveValue('https://manager.example.com/api/auth/callback');
    await expect(page.getByLabel('Google Client Secret')).toHaveValue('');
  });

  test('saves correct vars to config API', async ({ page }) => {
    const saved = [];
    await page.route(`/api/apps/${APP_NAME}/config`, (route) => {
      if (route.request().method() === 'POST') {
        saved.push(JSON.parse(route.request().postData() || '{}'));
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });
    await goToExtensions(page);

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Google Client ID').fill('my-client-id');
    await page.getByLabel('Google Client Secret').fill('my-secret');
    await page.getByLabel('Callback URL').fill('https://example.com/callback');
    await page.getByRole('button', { name: 'Save (no restart)' }).click();

    await expect(page.getByRole('button', { name: 'Save (no restart)' })).toHaveCount(0);
    expect(saved).toHaveLength(1);
    expect(saved[0].vars).toMatchObject({
      GOOGLE_CLIENT_ID: 'my-client-id',
      GOOGLE_CLIENT_SECRET: 'my-secret',
      GOOGLE_CALLBACK_URL: 'https://example.com/callback',
    });
    expect(saved[0].noRestart).toBe(true);
  });

  test('shows error for no-changes save (all fields empty)', async ({ page }) => {
    await mockAppConfig(page, {});
    let saved = false;
    await page.route(`/api/apps/${APP_NAME}/config`, (route) => {
      if (route.request().method() === 'POST') saved = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await goToExtensions(page);

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByRole('button', { name: 'Save (no restart)' }).click();

    await expect(page.getByText('No changes to save')).toBeVisible();
    expect(saved).toBe(false);
  });

  test('Cancel closes form without saving', async ({ page }) => {
    await mockAppConfig(page, {});
    let saved = false;
    await page.route(`/api/apps/${APP_NAME}/config`, (route) => {
      if (route.request().method() === 'POST') saved = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await goToExtensions(page);

    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByLabel('Google Client ID').fill('some-id');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('button', { name: 'Configure' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save (no restart)' })).toHaveCount(0);
    expect(saved).toBe(false);
  });
});
