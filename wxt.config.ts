import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: () => ({
    name: 'LinkedIn Salary Estimator',
    description:
      'Shows estimated salary range and total compensation next to the current role on LinkedIn profiles.',
    permissions: ['storage'],
    host_permissions: ['https://ipapi.co/*', 'https://ipwho.is/*'],
  }),
  // Firefox policy warning (data collection) — review before AMO submit:
  // https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
