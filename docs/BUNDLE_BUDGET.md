# Bundle budget

**Status:** enforced in CI · **Last updated:** 2026-11-10

adraw stays lightweight by enforcing a hard gzip budget for `@adraw/core` and a
tree-shaking smoke test for helper imports. The budget is measured by
`pnpm size` (`size-limit` + `@size-limit/esbuild`) after `pnpm build`.

## Budgets

| Entry                                     | Limit | Current |
| ----------------------------------------- | ----- | ------- |
| `@adraw/core` full bundle                 | 45 kB | 42.2 kB |
| `@adraw/core` importing `AdrawCanvas`     | 43 kB | 40.2 kB |
| `@adraw/core` importing `createRectangle` | 5 kB  | 0.4 kB  |

All sizes are minified and gzipped, including dependencies. Core must keep **zero
runtime dependencies**.

## How it is enforced

- `.github/workflows/ci.yml` runs `pnpm size` after the build.
- `package.json` contains the `size-limit` entries and limits.
- `@adraw/core/package.json` sets `"sideEffects": false`.
- The `createRectangle` entry imports a single helper, so an accidental pull of
  the whole DOM adapter or engine fails the smoke test.

Run it locally:

```bash
pnpm build
pnpm size
```

## Rules

- Every change to `@adraw/core` must keep `pnpm size` green.
- New features should fit the existing budget. If a feature cannot fit:
  1. Reduce or lazy-load code first.
  2. Move the feature to an optional entry point or a separate package.
  3. Only then raise the budget, with a rationale in the PR and an update to
     this document and the roadmap metrics.
- Do not add runtime dependencies without an explicit decision. Dev-only tooling
  is fine.
- Keep imports tree-shakable: prefer named imports and avoid top-level side
  effects.
- Optional heavy features (collaboration, embeds, rich text, PDF, hand-drawn
  rendering) belong in separate packages or entry points, not in core.

## Why the full budget is 45 kB

The versioned document contract (#10) added runtime validation and migrations,
raising the full bundle from roughly 38.7 kB to 42.2 kB. The previous 40 kB
target predated that work. 45 kB keeps the guardrail close to the real package
while leaving room for the remaining P0 items; revisit it if validation is moved
to an optional entry point.

## Raising the budget

A budget change is a product decision, not a side effect of a feature PR. The PR
must state why the feature cannot be split, include the new measurement, update
this file and `docs/ROADMAP.md`, and get explicit approval.
