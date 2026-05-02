import './style.css';
import browser from '@/lib/browser';
import { CURRENCY_OPTIONS, isOfferedCurrency } from '@/lib/currencies';
import { setUserCurrency, type LseSettings } from '@/lib/lse-settings';
import {
  mergeLlmSettings,
  readLlmSettingsFull,
  toLlmSettingsView,
  type LlmSettingsView,
  type LlmStoredSettings,
} from '@/lib/llm-settings';
import { friendlyLlmErrorMessage } from '@/lib/llm-user-errors';
import { completeWithStoredSettings } from '@/lib/llm/router';

const MSG_GET_SETTINGS = { type: 'lse:getSettings' as const };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSelectOptions(current: string): string {
  let html = '';
  if (!isOfferedCurrency(current)) {
    html += `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)} (saved)</option>`;
  }
  for (const o of CURRENCY_OPTIONS) {
    const sel = o.code === current ? ' selected' : '';
    html += `<option value="${o.code}"${sel}>${escapeHtml(o.label)}</option>`;
  }
  return html;
}

function currencyHint(): string {
  return 'Display currency for salary estimates on LinkedIn profiles. Your choice is saved in this browser.';
}

async function loadCurrencySettings(): Promise<LseSettings> {
  return (await browser.runtime.sendMessage(MSG_GET_SETTINGS)) as LseSettings;
}

async function loadLlmView(): Promise<LlmSettingsView> {
  return toLlmSettingsView(await readLlmSettingsFull());
}

function mount(currency: LseSettings, llm: LlmSettingsView): void {
  const app = document.querySelector('#app')!;

  app.innerHTML = `
    <main class="popup">
      <h1 class="popup__title">Salary Estimator</h1>

      <section class="popup__section" aria-labelledby="lse-curr-heading">
        <h2 class="popup__subtitle" id="lse-curr-heading">Currency</h2>
        <label class="popup__label" for="lse-currency">Display currency</label>
        <select id="lse-currency" class="popup__select" autocomplete="off"></select>
        <p class="popup__hint" id="lse-hint"></p>
      </section>

      <section class="popup__section" aria-labelledby="lse-llm-heading">
        <h2 class="popup__subtitle" id="lse-llm-heading">Google Gemini</h2>
        <p class="popup__text popup__text--small">
          Paste an API key from <a class="popup__link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
          Keys stay in this browser only (<code class="popup__code">storage.local</code>).
          If you hit quota or deprecation errors, try another model id (e.g. <code class="popup__code">gemini-2.5-flash</code>) — see
          <a class="popup__link" href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noreferrer">rate limits</a>.
        </p>
        <label class="popup__label" for="lse-gemini-key">Gemini API key</label>
        <input id="lse-gemini-key" class="popup__input" type="password" autocomplete="off" spellcheck="false"
          placeholder="" />
        <label class="popup__label" for="lse-gemini-model">Model id</label>
        <input id="lse-gemini-model" class="popup__input" type="text" autocomplete="off"
          placeholder="gemini-2.5-flash" />

        <p class="popup__hint" id="lse-llm-status" role="status"></p>
        <button type="button" class="popup__btn popup__btn--secondary" id="lse-llm-test">Test LLM connection</button>
        <button type="button" class="popup__btn" id="lse-llm-save">Save LLM settings</button>
      </section>

      <p class="popup__text popup__text--muted">
        Page logs: LinkedIn tab → F12 → filter <code class="popup__code">salary-estimator</code>. Gemini runs in the extension service worker (chrome://extensions → Service worker).
      </p>
    </main>
  `;

  const sel = app.querySelector('#lse-currency') as HTMLSelectElement;
  sel.innerHTML = buildSelectOptions(currency.currencyCode);

  const hint = app.querySelector('#lse-hint') as HTMLParagraphElement;
  hint.textContent = currencyHint();

  sel.addEventListener('change', async () => {
    await setUserCurrency(sel.value);
    const next = await loadCurrencySettings();
    Object.assign(currency, next);
    sel.innerHTML = buildSelectOptions(next.currencyCode);
    hint.textContent = currencyHint();
  });

  const geminiKey = app.querySelector('#lse-gemini-key') as HTMLInputElement;
  const geminiModel = app.querySelector('#lse-gemini-model') as HTMLInputElement;
  const llmStatus = app.querySelector('#lse-llm-status') as HTMLParagraphElement;

  geminiModel.value = llm.geminiModel;
  geminiKey.placeholder = llm.geminiKeyConfigured ? 'Key saved — enter new to replace' : 'Paste API key';

  const saveLlm = async (): Promise<LlmSettingsView> => {
    const patch: Partial<LlmStoredSettings> = {
      geminiModel: geminiModel.value.trim(),
    };
    const gk = geminiKey.value.trim();
    if (gk.length > 0) {
      patch.geminiApiKey = gk;
    }
    const stored = await mergeLlmSettings(patch);
    const next = toLlmSettingsView(stored);
    Object.assign(llm, next);
    geminiKey.value = '';
    geminiKey.placeholder = llm.geminiKeyConfigured ? 'Key saved — enter new to replace' : 'Paste API key';
    return next;
  };

  app.querySelector('#lse-llm-save')!.addEventListener('click', async () => {
    llmStatus.textContent = 'Saving…';
    try {
      await saveLlm();
      llmStatus.textContent = 'Saved.';
    } catch (e) {
      console.error('[salary-estimator] LLM save failed', e);
      llmStatus.textContent = `Save failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  });

  app.querySelector('#lse-llm-test')!.addEventListener('click', async () => {
    const btn = app.querySelector('#lse-llm-test') as HTMLButtonElement;
    btn.disabled = true;
    llmStatus.textContent = 'Testing…';
    try {
      await saveLlm();
      const result = await completeWithStoredSettings(
        'Reply with exactly the two characters OK and nothing else.',
      );
      if (result.ok) {
        const preview = result.text.slice(0, 120);
        llmStatus.textContent = `OK — model replied: ${preview}${result.text.length > 120 ? '…' : ''}`;
      } else {
        llmStatus.textContent = `Error: ${friendlyLlmErrorMessage(result.error)}`;
      }
    } catch (e) {
      llmStatus.textContent = `Error: ${friendlyLlmErrorMessage(e instanceof Error ? e.message : String(e))}`;
    } finally {
      btn.disabled = false;
    }
  });
}

void Promise.all([loadCurrencySettings(), loadLlmView()]).then(([currency, llm]) => {
  mount(currency, llm);
});
