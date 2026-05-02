---
name: doc-maintainence
description: >-
  Updates the repository README after each shipped feature so Goals, Features,
  status, and Development instructions stay accurate. Use whenever a
  user-facing feature is completed, after substantive implementation work, or
  when the user asks to sync documentation.
---

# README maintenance (doc-maintainence)

## When to apply

After completing work that changes behavior, UX, scripts, or setup—or when the user asks to refresh docs.

## What to do

1. Read `README.md` end-to-end.
2. If the project has no **Features** (or **What works**) section, add one near **Goals** or **Status**.
3. Add or edit a short bullet for **each** new capability (what it does, where it lives in the codebase if helpful—one line).
4. Update **Status** so it matches reality (e.g. remove “not implemented” only when true).
5. Update **Development** (commands, load-unpacked paths, env vars) only if those changed.
6. Keep prose concise; do not duplicate the whole codebase.

## Checklist before finishing

- [ ] Goals still match product intent.
- [ ] New behavior is reflected under Features (or equivalent).
- [ ] Status is honest.
- [ ] Commands/paths in Development still work.
