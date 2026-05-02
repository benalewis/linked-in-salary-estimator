---
name: architecture-health
description: >-
  Audits repository architecture health, ties findings to classic code smells, and checks
  compliance with YAGNI, KISS, DRY, and SOLID. When violations are fixable safely in-tree,
  refactors offending code rather than stopping at commentary. Use for architecture reviews,
  smell sweeps, principle checks, structural cleanup requests, pre-refactor audits, or when
  the user names YAGNI, KISS, DRY, or SOLID alongside this skill.
disable-model-invocation: true
---

# Architecture health (YAGNI / KISS / DRY / SOLID)

## When to invoke

Explicitly `@architecture-health`, or whenever the user asks for an architecture/smell/principles audit **and agrees this skill applies**.

## Mandatory outcome

1. Produce a short written assessment (structure, smells, principle gaps).
2. **Refactor offending code** in this repository whenever a fix is local, reversible, and test-backed—unless the user has blocked edits or scope is plainly unsafe (missing tests + high risk). Prefer many small commits over theoretical advice.
3. Run `npm run test` after substantive changes; run `npm run compile` when types move.

---

## Workflow

### 1. Map the codebase (few minutes)

- **Extension shell**: `entrypoints/`, `wxt.config.ts`, manifests.
- **Domain / UI logic**: `lib/` (prefer pure helpers separate from DOM + messaging).
- **Assets / styles**: `assets/`.
- **Automation**: `tests/`, npm scripts.

Note dependency direction: **entrypoints consume `lib/`**; **`lib/` does not import entrypoints.** Flag cycles immediately.

### 2. Assess architecture shape

| Question | Poor signal | Preferred direction |
| -------- | ----------- | ------------------- |
| Separation of concerns | One file mixes scrape + LLM compose + injection + formatting | Narrow modules; façade files only orchestrate |
| Boundaries | Direct `chrome.*` / `browser.*` deep in parsers | Isolate in `browser` shim or adapters (already a pattern—extend consistently) |
| Change impact | Editing one helper forces unrelated test rewrites everywhere | Stable interfaces; internal refactors localized |
| Testability | IO and pure logic intertwined | Injectable IO; pure units tested without network |

---

## Principle checks → what to refactor

### YAGNI (You Aren’t Gonna Need It — not “YAGI”)

- Remove **unused exports**, dead branches, feature flags leading nowhere, speculative abstractions, “future-ready” generics with one call site.
- **Refactor**: delete or simplify; do not preserve “maybe later” layers without a tracked need.

### KISS

- Prefer obvious control flow over cleverness; replace deep nesting with early returns or small functions.
- **Refactor**: extract only when readability or testing wins—avoid new abstraction layers purely for symmetry.

### DRY

- Duplication of **meaning** (same invariant in many places), not tyrannical dedup of incidental two-liners that would couple unrelated contexts.
- **Refactor**: shared helper/constants only when duplication risks drift or bugs; place helpers near meaningful domain boundaries.

### SOLID (pragmatic TS / extension context)

| Letter | Aim | Typical fix |
| ------ | --- | ----------- |
| **S** Single responsibility | One primary reason for a module to change | Split file or extract cohesive block |
| **O** Open for extension | New behaviour without exploding switches | Prefer maps/strategies/plugins over growing `switch` hubs |
| **L** Liskov substitutability | Implementations honour types/contracts | Narrow types; avoid pretending unrelated shapes unify |
| **I** Interface segregation | Small, focused APIs | Split props/options; avoid “god” configs |
| **D** Dependency inversion | High-level logic depends on abstractions | Keep fetch/storage/console behind injectable/mockable seams |

---

## Code smells → flag AND fix examples

Treat catalog entries as prompts to search the tree; attach **concrete refs** (`path:lines`) and a **minimal fix**.

| Smell | What to scan | Typical refactor |
| ----- | ------------- | ---------------- |
| Long method | > ~50 lines or mixed abstraction levels | Extract steps; keep orchestration readable |
| Long parameter list / data clumps | Repeated parameter groups | Options object / small struct type |
| Divergent change / shotgun surgery | One concept forces edits everywhere | Consolidate invariant; introduce boundary module |
| Feature envy | Function mostly reaches into another module’s internals | Move method or widen clean API |
| Primitive obsession | Stringly-typed enums / concatenated payloads | Lightweight types / parsers |
| Speculative generality | Abstractions unused or single-use | Inline or delete |
| Leaky coupling | Globals, cross-layer imports violating direction | Shim or relocate |

Also watch: **opaque side-effects**, **error swallowing**, **magic numbers/strings** drifting without one source of truth (DRY crosses here).

---

## Reporting template (paste into reply)

Use after discovery and before/alongside edits:

```markdown
## Architecture health summary
- Strengths:
- Risks:

## Principle gaps (YAGNI / KISS / DRY / SOLID)

| Area | Principle | Issue | Planned fix |

## Refactors executed / skipped
- Done:
- Deferred (reason):

## Verification
- `npm run test` — pass/fail
- `npm run compile` — pass/fail
```

---

## Guardrails

- Match existing naming, import style (`@/` paths), formatting, file layout.
- **No drive-by churn**: diff should trace to smelled code or callers directly broken by the fix.
- If a refactor would exceed the user’s scoped request, propose a follow-up—but still fix clearly local violations surfaced during the audit.
- Never weaken security-sensitive behaviour when consolidating (HTML injection surfaces, CSP, messaging handlers).
