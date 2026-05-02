---
name: public-repo-anonymizer
description: >-
  Scans this repository before open-sourcing: secrets, credentials, accidental PII, personal names,
  local paths, and store-only artifacts. Replace real names with generic placeholders (e.g. John Doe).
  Guides redaction or safe placeholders without weakening security guidance in code comments. Use when
  making the repo public, before a Chrome Web Store/GitHub Pages release, or whenever the user asks to
  anonymize, scrub secrets, or verify nothing sensitive ships.
disable-model-invocation: true
---

# Public repo anonymizer

## Invoke

Explicitly **`@public-repo-anonymizer`**, or any request to scrub / verify before **public GitHub**.

## Mandatory outcome

Produce a short **risk list** (file + finding), then apply **minimal fixes** the user agrees to (placeholder URLs, `.gitignore`, moving samples).

- **Personal names:** Any identifiable real **person names** (authors, testers, fictitious-but-real acquaintances in examples, people in screenshots) must be anonymized unless the repo is explicitly meant to **credit** someone. Prefer stable fictitious placeholders: **`John Doe`**, **`Jane Doe`**, or **`Alex Example`** — not initials that still map to someone. Applies to **`LICENSE`** copyright holders, **`CODEOWNERS`**, **`README`**, **`docs/`**, **`description.txt`**, commit-message examples, and **test/fixture HTML** (e.g. LinkedIn-ish cards). Maintain **consistent** placeholders within a narrative so snippets stay readable.

**Never paste real recovered secrets** into chat—rotate them if leaked.

---

## Automated sweep (agent runs or instructs user to run)

From repo root, search likely leaks (adapt if tools differ):

```
rg -n "AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{10,}|xox[baprs]-|ghp_[A-Za-z0-9]+|github_pat_|-----BEGIN [A-Z ]+PRIVATE KEY-----|CLIENT_SECRET\\s*=|REFRESH_TOKEN\\s*=" --glob '!package-lock.json' --glob '!**/node_modules/**'
rg -ni "\\.env\\b|refresh.token|passwd|client_secret[\"']\\s*:\\s*[\"'][^$]" --glob '*.{md,yml,yaml,ts,js,html,json,env}'
```

Also:

- `git ls-files` — ensure **`.output/`**, **`.env*`**, **keys**, **`.pem`**, **uploaded zips** are not tracked.
- `git log -p --all -S 'AIza' -S 'sk-'` (one-off) if history might contain keys **→** consider **history rewrite** or `git filter-repo` (serious; warn user).

---

## Checklist (human + agent)

| Area | Action |
|------|--------|
| **Secrets** | No real API keys, OAuth client secrets, refresh tokens, or Chrome Web Store tokens in committed files. CI must use `${{ secrets.* }}` only. |
| **Paths** | Replace machine-specific paths (`C:\Users\...`, `V:\...`) in docs or scripts with neutral examples. |
| **Privacy / contact** | Public `docs/privacy-policy.html` and `description.txt`: support links often use GitHub **`OWNER/repo`** — for a fully anonymous fork, swap to placeholders or omit; otherwise confirm intent to ship real handles. |
| **Personal names** | No real identifying names outside intentional attribution policy; anonymize examples and fixtures (**`John Doe`**, **`Jane Doe`**, etc.). |
| **Images** | `image.png`, screenshots, or store assets: no real DMs, emails, faces, or profile data unless intentional. |
| **Tests** | Fake keys like `test-key` / `secret-g` are fine; no production-like 40-char Google keys. |
| **dependabot / workflows** | No hardcoded registry tokens; `npm whoami` output must not be in repo. |

---

## If something leaked

1. **Revoke / rotate** the credential (Google Cloud OAuth, Gemini key, GitHub PAT, Chrome Web Store refresh token).
2. Remove from **current tree** and from **history** if it was pushed (BFG / `git filter-repo`).
3. Re-read Google GitHub OAuth client if client secret rotated.

---

## License reminder

Prefer **MIT** for this repo unless the user explicitly wants copyleft—then discuss **GPL-3.0** tradeoffs (`LICENSE` should match `package.json` **`license`** field).
