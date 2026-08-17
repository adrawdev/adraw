# Task List — adraw core simplify & split

Status legend: [ ] todo · [~] in progress · [x] done

## Phase 1: Pure extractions

- [x] Task 1: Extract SVG helpers → `src/dom/svg.ts` (S)
- [x] Task 2: Deduplicate `clamp` in `viewport.ts` (XS) — no-op: already imported
- [x] Task 3: Split select tool → `tools/select/{index,brush,rotate,resize,move,state,resize-rotated}.ts` (M)
- [x] Task 4: Split draw tool → `tools/draw/{index,geometry}.ts` (S)
- [x] Task 5: Extract hit-testing → `elements/hit-test.ts` (S)
- [x] Task 5b: Small flat tools → `tools/{tool}/index.ts` (user-approved)

### Checkpoint A — PASSED (human review)

- [x] `pnpm lint` clean
- [x] `pnpm test` — 13 files / 151 tests pass unchanged
- [x] `pnpm build:core` succeeds

## Phase 2: Engine extraction (headless core)

- [x] Task 6: Introduce `CanvasEngine`, compose it in `AdrawCanvas` (M)
- [x] Task 7: Trim engine — `engine/media.ts` (S)
- [x] Task 8: Trim engine — `engine/selection.ts` + `engine/shortcuts.ts` (S)
- [x] Task 8b: `engine/internal.ts` + `engine/pointer.ts` (adapter hooks; user approved 387-line engine core as the cohesive floor)

### Checkpoint B — PASSED (boundary contract reviewed & approved)

- [x] `pnpm test` passes (headless suite green)
- [x] `pnpm lint` + `pnpm build:core` clean
- [x] Review engine/adapter boundary contract with human

## Phase 3: DOM adapter extraction

- [x] Task 9: Extract adapter core → `src/dom/adapter.ts` + `events.ts` + `touch.ts` (M)
- [x] Task 10: Extract text editor → `src/dom/text-editor.ts` (M)
- [x] Task 11: Extract render machinery → `src/dom/render.ts` + `render/overlay.ts` + `render/overlay-nodes.ts` (M)
- [x] Task 12: Finalize facade → `canvas.ts` (250 lines) + `options.ts`; API-compat gate (S)

### Checkpoint C — PASSED

- [x] Full `pnpm test` green (151)
- [x] `pnpm build:all` clean (12 builds); public d.ts surface identical to pre-refactor
- [x] `pnpm test:e2e` — chromium 46/46; firefox 45/46 + webkit failures are **pre-existing** (verified identical on baseline via git stash)

## Phase 4: Framework bindings

- [x] Task 13: Split React hooks → `react/src/hooks.ts` (S)
- [x] Task 14: Split Solid hooks → `solid/src/hooks.ts` (S)

### Checkpoint D: Complete — PASSED

- [x] All acceptance criteria met
- [x] `pnpm lint`, `pnpm test` (151), `pnpm build:all` (12), e2e chromium (46) all green
- [x] `examples/vite-react` and `examples/vite-solid` build
- [x] Zero source type errors (`tsc -p packages/core/tsconfig.json --noEmit`)
- [x] Ready for human review

## Notes / Deviations from plan

- `engine/engine.ts` at 387 lines — user-approved exception (cohesive class core; all extractable logic moved out)
- Tests exempt from 250-line rule; `transform-overlay.test.ts` needed 2 private-member path updates (`engine.*`, `mounted.state.svgElement`) since private state moved
- No changesets created (code-only refactor, no API change — release decision left to maintainers)
