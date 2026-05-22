import GoogleAuthSetupStep from './GoogleAuthSetupStep.jsx';
import GoogleAuthSettings from './GoogleAuthSettings.jsx';

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
      tab: 'extensions',
      tabLabel: 'Extensions',
      tabOrder: 99,
      slot: 'auth',
      providerId: 'google',
      component: GoogleAuthSettings,
      order: 1,
    },
  ],
};
