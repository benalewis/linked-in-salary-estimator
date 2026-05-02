import './style.css';
import browser from '@/lib/browser';
import { CURRENCY_OPTIONS, isOfferedCurrency } from '@/lib/currencies';
import { applyGeoCurrency, setUserCurrency, type LseSettings } from '@/lib/lse-settings';

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

async function loadSettings(): Promise<LseSettings> {
  return (await browser.runtime.sendMessage(MSG_GET_SETTINGS)) as LseSettings;
}

function mount(settings: LseSettings): void {
  const app = document.querySelector('#app')!;

  app.innerHTML = `
    <main class="popup">
      <h1 class="popup__title">Salary Estimator</h1>
      <label class="popup__label" for="lse-currency">Currency</label>
      <select id="lse-currency" class="popup__select" autocomplete="off"></select>
      <p class="popup__hint" id="lse-hint"></p>
      <button type="button" class="popup__btn" id="lse-geo">Use location currency</button>
      <p class="popup__text popup__text--muted">
        Region currency uses ipapi.co, then ipwho.is if the first is rate-limited (max ~1 request/day per source).
        Default is USD if both fail. Optional: open the LinkedIn profile tab → F12 → Console and filter
        <code class="popup__code">salary-estimator</code> — geo logs also appear under chrome://extensions →
        this extension → Service worker.
      </p>
    </main>
  `;

  const sel = app.querySelector('#lse-currency') as HTMLSelectElement;
  sel.innerHTML = buildSelectOptions(settings.currencyCode);

  const hint = app.querySelector('#lse-hint') as HTMLParagraphElement;
  hint.textContent = formatHint(settings);

  sel.addEventListener('change', async () => {
    await setUserCurrency(sel.value);
    const next = await loadSettings();
    Object.assign(settings, next);
    hint.textContent = formatHint(settings);
  });

  const btn = app.querySelector('#lse-geo') as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const next = await applyGeoCurrency();
      Object.assign(settings, next);
      sel.innerHTML = buildSelectOptions(next.currencyCode);
      hint.textContent = formatHint(settings);
    } finally {
      btn.disabled = false;
    }
  });
}

void loadSettings().then(mount);
