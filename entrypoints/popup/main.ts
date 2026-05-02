import './style.css';
import browser from '@/lib/browser';
import { CURRENCY_OPTIONS, isOfferedCurrency } from '@/lib/currencies';
import { applyGeoCurrency, setUserCurrency, type LseSettings } from '@/lib/lse-settings';
import {
  mergeLlmSettings,
  readLlmSettingsFull,
  toLlmSettingsView,
  type LlmSettingsView,
  type LlmStoredSettings,
} from '@/lib/llm-settings';
import { completeWithStoredSettings, type LlmCompleteResult } from '@/lib/llm/router';

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
    html += `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)} (detected)</option>`;
  }
  for (const o of CURRENCY_OPTIONS) {
    const sel = o.code === current ? ' selected' : '';
    html += `<option value="${o.code}"${sel}>${escapeHtml(o.label)}</option>`;
  }
  return html;
}

function formatHint(s: LseSettings): string {
  if (s.currencyIsUserChoice) {
    return 'You selected this currency. “Use location currency” re-checks your region from your IP.';
  }
  const g = s.geoCurrencyCode ?? s.currencyCode;
  return `Region-based default (${g}). Choose another currency above to keep it fixed.`;
}

async function loadCurrencySettings(): Promise<LseSettings> {
  return (await browser.runtime.sendMessage(MSG_GET_SETTINGS)) as LseSettings;
}

async function loadLlmView(): Promise<LlmSettingsView> {
  return toLlmSettingsView(await readLlmSettingsFull());
}

function setBlockVisibility(geminiEl: HTMLElement, openaiEl: HTMLElement, providerId: string): void {
  geminiEl.hidden = providerId !== 'gemini';
  openaiEl.hidden = providerId !== 'openai';
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
        <button type="button" class="popup__btn popup__btn--secondary" id="lse-geo">Use location currency</button>
      </section>

      <section class="popup__section" aria-labelledby="lse-llm-heading">
        <h2 class="popup__subtitle" id="lse-llm-heading">LLM</h2>
        <p class="popup__text popup__text--small">
          Choose a provider and paste an API key. Keys stay in this browser only (<code class="popup__code">storage.local</code>).
          Gemini: create a key in <a class="popup__link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
          OpenAI: <a class="popup__link" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">API keys</a>.
          If Google returns quota or deprecation errors, try another model id (e.g. <code class="popup__code">gemini-2.5-flash</code>, <code class="popup__code">gemini-1.5-flash</code>), wait for reset, or enable billing — see
          <a class="popup__link" href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noreferrer">rate limits</a>.
        </p>
        <label class="popup__label" for="lse-llm-provider">Provider</label>
        <select id="lse-llm-provider" class="popup__select">
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
        </select>

        <div id="lse-llm-gemini" class="popup__llm-block">
          <label class="popup__label" for="lse-gemini-key">Gemini API key</label>
          <input id="lse-gemini-key" class="popup__input" type="password" autocomplete="off" spellcheck="false"
            placeholder="" />
          <label class="popup__label" for="lse-gemini-model">Model id</label>
          <input id="lse-gemini-model" class="popup__input" type="text" autocomplete="off"
            placeholder="gemini-2.5-flash" />
        </div>

        <div id="lse-llm-openai" class="popup__llm-block">
          <label class="popup__label" for="lse-openai-key">OpenAI API key</label>
          <input id="lse-openai-key" class="popup__input" type="password" autocomplete="off" spellcheck="false"
            placeholder="" />
          <label class="popup__label" for="lse-openai-model">Model id</label>
          <input id="lse-openai-model" class="popup__input" type="text" autocomplete="off"
            placeholder="gpt-4o-mini" />
        </div>

        <p class="popup__hint" id="lse-llm-status" role="status"></p>
        <button type="button" class="popup__btn popup__btn--secondary" id="lse-llm-test">Test LLM connection</button>
        <button type="button" class="popup__btn" id="lse-llm-save">Save LLM settings</button>
      </section>

      <p class="popup__text popup__text--muted">
        Page logs: LinkedIn tab → F12 → filter <code class="popup__code">salary-estimator</code>. Geo / LLM network runs in the extension service worker (chrome://extensions → Service worker).
      </p>
    </main>
  `;

  const sel = app.querySelector('#lse-currency') as HTMLSelectElement;
  sel.innerHTML = buildSelectOptions(currency.currencyCode);

  const hint = app.querySelector('#lse-hint') as HTMLParagraphElement;
  hint.textContent = formatHint(currency);

  sel.addEventListener('change', async () => {
    await setUserCurrency(sel.value);
    const next = await loadCurrencySettings();
    Object.assign(currency, next);
    hint.textContent = formatHint(currency);
  });

  const geoBtn = app.querySelector('#lse-geo') as HTMLButtonElement;
  geoBtn.addEventListener('click', async () => {
    geoBtn.disabled = true;
    try {
      const next = await applyGeoCurrency();
      Object.assign(currency, next);
      sel.innerHTML = buildSelectOptions(next.currencyCode);
      hint.textContent = formatHint(currency);
    } finally {
      geoBtn.disabled = false;
    }
  });

  const providerSel = app.querySelector('#lse-llm-provider') as HTMLSelectElement;
  const geminiBlock = app.querySelector('#lse-llm-gemini') as HTMLElement;
  const openaiBlock = app.querySelector('#lse-llm-openai') as HTMLElement;
  const geminiKey = app.querySelector('#lse-gemini-key') as HTMLInputElement;
  const geminiModel = app.querySelector('#lse-gemini-model') as HTMLInputElement;
  const openaiKey = app.querySelector('#lse-openai-key') as HTMLInputElement;
  const openaiModel = app.querySelector('#lse-openai-model') as HTMLInputElement;
  const llmStatus = app.querySelector('#lse-llm-status') as HTMLParagraphElement;

  providerSel.value = llm.providerId;
  geminiModel.value = llm.geminiModel;
  openaiModel.value = llm.openaiModel;
  geminiKey.placeholder = llm.geminiKeyConfigured ? 'Key saved — enter new to replace' : 'Paste API key';
  openaiKey.placeholder = llm.openaiKeyConfigured ? 'Key saved — enter new to replace' : 'Paste API key';

  setBlockVisibility(geminiBlock, openaiBlock, llm.providerId);

  providerSel.addEventListener('change', () => {
    setBlockVisibility(geminiBlock, openaiBlock, providerSel.value);
    llmStatus.textContent = '';
  });

  const saveLlm = async (): Promise<LlmSettingsView> => {
    const patch: Partial<LlmStoredSettings> = {
      providerId: providerSel.value === 'openai' ? 'openai' : 'gemini',
      geminiModel: geminiModel.value.trim(),
      openaiModel: openaiModel.value.trim(),
    };
    const gk = geminiKey.value.trim();
    const ok = openaiKey.value.trim();
    if (gk.length > 0) {
      patch.geminiApiKey = gk;
    }
    if (ok.length > 0) {
      patch.openaiApiKey = ok;
    }
    const stored = await mergeLlmSettings(patch);
    const next = toLlmSettingsView(stored);
    Object.assign(llm, next);
    geminiKey.value = '';
    openaiKey.value = '';
    geminiKey.placeholder = llm.geminiKeyConfigured ? 'Key saved — enter new to replace' : 'Paste API key';
    openaiKey.placeholder = llm.openaiKeyConfigured ? 'Key saved — enter new to replace' : 'Paste API key';
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
        llmStatus.textContent = `Error: ${result.error}`;
      }
    } catch (e) {
      llmStatus.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      btn.disabled = false;
    }
  });
}

void Promise.all([loadCurrencySettings(), loadLlmView()]).then(([currency, llm]) => {
  mount(currency, llm);
});
