# LinkedIn Salary Estimator

## Goals

This project aims to ship a **Chrome extension** that enhances LinkedIn profile pages.

When you view a profile (including your own), the extension should:

- **Estimate salary from public sources** — combine or infer a reasonable range from salary data that appears elsewhere on the web (job boards, surveys, company pages, etc.), not from anything private inside LinkedIn.
- **Show a compact summary next to “current position”** — a small UI box beside the listed role with:
  - **Estimated low–high salary range**
  - **Total compensation (TC)**, including bonuses where applicable

The intent is to give a quick, at-a-glance sense of market compensation for the role as shown on the profile, with clear labeling that figures are **estimates** derived from external data.

## Features

- **Profile Experience panel** — On `/in/…` profile pages, the content script finds Experience (including newer layouts), prefers a row whose dates include **Present** / **Présent**, then falls back to a **global scan** of the main column, then (if needed) the **first Experience row** so a placeholder panel still appears. See `matchStrategy` / `inject summary` in console (`lib/linkedin-panel.ts`, styles in `assets/linkedin-panel.css`). Values are placeholders until public salary sources are integrated.

- **LLM layer (provider-agnostic)** — In the toolbar popup, choose **Google Gemini** or **OpenAI**, paste an API key (stored only in **`chrome.storage.local`**), optional model id, then **Save** / **Test LLM connection**. The service worker runs completions via `lib/llm/route-completion.ts` (Gemini: Generative Language API; OpenAI: Chat Completions). Wire profile salary prompts to `completeWithStoredSettings()` / `routeLlmCompletion()` next.

## Status

Early-stage — salary **data sources** and ranges are not wired up; UI shell is in place on profiles with a current role.

## Development

Stack: **WXT** (Vite + Manifest V3), **TypeScript**, and **webextension-polyfill** (`lib/browser.ts`) for consistent `browser` APIs across **Chrome**, **Edge**, and **Firefox**.

| Command | Description |
|--------|-------------|
| `npm install` | Install dependencies; runs `wxt prepare` for types. |
| `npm run dev` | Dev mode (Chrome, MV3). |
| `npm run dev:edge` | Dev mode (Chromium-based Edge, MV3). |
| `npm run dev:firefox` | Dev mode (Firefox, MV3). |
| `npm run build` | Production build → `.output/chrome-mv3/`. |
| `npm run build:edge` | → `.output/edge-mv3/`. |
| `npm run build:firefox` | → `.output/firefox-mv3/`. |
| `npm run zip` / `zip:edge` / `zip:firefox` | Zips each store package. |
| `npm run test` | Vitest unit tests (`tests/**/*.test.ts`). |
| `npm run compile` | Typecheck only (`tsc --noEmit`). |

Settings are stored in **`chrome.storage.local`** (works without Chrome Sync). Legacy entries in `storage.sync` are migrated once when local is empty.

LLM API keys never sync to the cloud with this storage mode; get a **Gemini** key from [Google AI Studio](https://aistudio.google.com/apikey) or an **OpenAI** key from your OpenAI account. Host permissions include `generativelanguage.googleapis.com` and `api.openai.com`.

Load the built folder as an unpacked / temporary extension:

- **Chrome:** `chrome://extensions` → Developer mode → **Load unpacked** → choose `.output/chrome-mv3`.
- **Edge:** `edge://extensions` → **Load unpacked** → `.output/edge-mv3`.
- **Firefox:** `about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick `.output/firefox-mv3/manifest.json`.

**Debugging on LinkedIn:** After `npm run build`, reload the extension on `chrome://extensions`, then hard-refresh the profile.

- **Page console** (F12 on the **LinkedIn tab**, not the extension popup): filter **`salary-estimator`**. You should see **`[salary-estimator] ready`**, **`currency label`**, and **`[salary-estimator] inject`**. If you see nothing, the content script is not running (wrong tab, extension disabled, or filter hiding messages).
- **Service worker** (geo / storage): `chrome://extensions` → **Salary Estimator** → **Service worker** → *Inspect views*. Geo lookups log as **`[salary-estimator] geo`** and **`[salary-estimator] settings`**.

For full detail, filter `[salary-estimator:debug]`. Silence verbose lines: `sessionStorage.setItem('lse-debug', '0')` in the page console; turn back on with `'1'`.

Project layout (WXT entrypoints):

- `entrypoints/background.ts` — service worker.
- `entrypoints/content.ts` — runs on `*.linkedin.com` (injects the salary panel on profiles).
- `assets/linkedin-panel.css` — styles for the injected panel.
- `entrypoints/popup/` — toolbar popup UI.
- `lib/lse-debug.ts` — debug toggle for content-script logs.
