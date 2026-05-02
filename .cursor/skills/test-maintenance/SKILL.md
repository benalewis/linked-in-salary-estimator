---
name: test-maintenance
description: >-
  Maintains automated tests for this repository. Whenever implementing or changing
  a feature, adds new tests or extends existing test files so behaviour stays
  covered. Use when developing features, fixing bugs in lib/ or entrypoints/, before
  merging substantive changes, or when the user asks to update tests.
---

# Test maintenance (linked-in-salary-estimator)

## When to apply

- After adding or changing behaviour in `lib/`, `entrypoints/`, or extension wiring.
- Before considering a feature done: tests must reflect the new contracts and edge cases.
- When fixing a bug: add a regression test that fails without the fix.

## What to do

1. Run `npm run test` (or `npm run test:watch` while iterating). Fix failures before finishing.
2. Prefer extending existing files under `tests/` (`*.test.ts`) over scattering one-off scripts.
3. Add tests that match the layer:
   - Pure logic (`lib/currencies.ts`, helpers): unit tests, no DOM.
   - DOM injection (`lib/linkedin-panel.ts`): `happy-dom` + minimal fixture HTML; cover success paths and important fallbacks (`not_profile_path`, `first-row-fallback`, etc.).
   - Async settings / geo / storage (`lib/lse-settings.ts`): mock `@/lib/browser` storage and `fetch`; avoid real network.
4. Keep assertions behaviour-focused (public outcomes), not implementation details, unless testing a deliberate invariant.
5. If you add a new module with non-trivial logic, create `tests/<area>.test.ts` and wire scenarios there.

## Verbatim requirement

Add or append existing tests every time we develop a feature.

## Commands

| Command           | Purpose                    |
| ----------------- | -------------------------- |
| `npm run test`    | CI-style single run        |
| `npm run test:watch` | Interactive runs      |
| `npm run compile` | Typecheck (also run often) |
