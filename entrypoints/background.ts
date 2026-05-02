import { ensureDefaultSettings, type LseSettings } from '@/lib/lse-settings';

const MSG_GET_SETTINGS = 'lse:getSettings' as const;

export default defineBackground(() => {
  console.info('[salary-estimator] background ready', browser.runtime.id);

  browser.runtime.onInstalled.addListener(() => {
    void ensureDefaultSettings();
  });

  browser.runtime.onMessage.addListener(
    (message: { type?: string }, _sender, sendResponse: (r: LseSettings) => void) => {
      if (message?.type === MSG_GET_SETTINGS) {
        void ensureDefaultSettings()
          .then((s) => {
            sendResponse(s);
          })
          .catch((err: unknown) => {
            console.error('[salary-estimator] getSettings / ensureDefaultSettings failed', err);
            sendResponse({
              currencyCode: 'USD',
              currencyIsUserChoice: false,
              geoCurrencyCode: null,
              geoLookupAt: null,
            });
          });
        return true;
      }
      return false;
    },
  );
});
