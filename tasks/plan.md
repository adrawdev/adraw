# Implementation Plan: Simplify core, dedupe, and split files >250 lines

## Overview

Refactor `@adraw/core` and the React/Solid bindings to reduce redundancy and bring every source file under 250 lines. The centerpiece is splitting `packages/core/src/canvas.ts` (2016 lines) into a headless `CanvasEngine` (pure logic), a `CanvasDomAdapter` (DOM/SVG), and a thin `AdrawCanvas` facade. Tools are restructured into `tools/{tool}/*.ts` directories, element hit-testing is extracted from `elements.ts`, and the duplicated `clamp` is consolidated. The public API surface of `@adraw/core` must remain byte-identical (verified by diffing `dist/index.d.ts`), so the 13 existing unit test files and all Playwright e2e specs pass unchanged.

## Architecture Decisions

1. **Full architecture split (user-approved):** `AdrawCanvas` decomposes into `CanvasEngine` (state, tools, history, events — headless) + `CanvasDomAdapter` (SVG mount, event wiring, text editor, render) + facade. This matches the documented "works headless" design in `packages/core/AGENTS.md`.
2. **Facade keeps the exact public surface.** Every public method, type, and export currently re-exported via `src/index.ts` stays on `AdrawCanvas`; `pointsToPath`, `createElementGroup`, `CanvasOptions`, `AdrawCanvasOptions`, `ToImageOptions`, `MediaInput`, `CanvasEventMap` are re-exported from their new homes.
3. **One-directional imports:** `dom/*` and `engine/*` may import each other only as `dom/* → engine/*`; the engine stays DOM-free by exposing a `renderRequested` callback the adapter registers.
4. **Internal cross-module access** (e.g. adapter reaching engine internals during text-edit commit) goes through `/** @internal */` accessors on `CanvasEngine` — never through widened public API.
5. **`tools/{tool}/*.ts` layout:** tools that split become directories with an `index.ts` factory. The `./select` / `./draw` import paths in `tools/index.ts` keep resolving via directory index, so consumers and the barrel need no path edits. Small flat tools stay flat until they approach the limit; `tools/base.ts` stays as the shared interface.
6. **Tests are exempt** from the 250-line rule (user-approved).
7. **Cross-framework hook duplication stays** (inherent to each framework's reactivity model). React/Solid hooks move to per-framework `hooks.ts` only.

## Task List

### Phase 1: Pure extractions (no behavior change)

- [ ] **Task 1: Extract SVG helpers → `src/dom/svg.ts`**
      Move `getTransformElementAttribute`, `pointsToPath`, `createElementGroup`, `appendTextLines` plus the module-level CSS-class/SVG constants (lines ~101–296 of `canvas.ts`) into `src/dom/svg.ts`. `canvas.ts` imports them and re-exports the public ones (`pointsToPath`, `createElementGroup`).
  - Acceptance: no test file edits; `pointsToPath`/`createElementGroup` still importable from `@adraw/core`
  - Verification: `pnpm test run packages/core/src/__tests__/line.test.ts` + `pnpm lint`
  - Deps: None · Files: `canvas.ts`, `src/dom/svg.ts` · Size: S

- [ ] **Task 2: Deduplicate `clamp`**
      `viewport.ts` currently redefines `clamp` (also in `coordinates.ts:96`). Remove the local copy and import from `./coordinates`.
  - Acceptance: no `function clamp` duplicate remains in `packages/core/src`
  - Verification: `pnpm test run packages/core/src/__tests__/viewport.test.ts` + `pnpm lint`
  - Deps: None · Files: `viewport.ts` · Size: XS

- [ ] **Task 3: Split select tool → `tools/select/`**
      Convert `tools/select.ts` (724 lines) into a directory: `index.ts` (factory, tool state, pointer-down hit-testing, move/resize drag, shared `getPointsBounds`/`boxesIntersect`), `brush.ts` (marquee/rubber-band mode), `rotate.ts` (rotation gesture math). Keep `createSelectTool` + `SelectToolOptions` exported from the same module path.
  - Acceptance: all select-related tests pass unchanged (`select-brush`, `select-flip`, `select-transform-state`, `select-deactivate`); every file in `tools/select/` < 250 lines
  - Verification: `pnpm test run packages/core/src/__tests__/select-*.test.ts` + `pnpm lint`
  - Deps: None · Files: `tools/select.ts` → `tools/select/{index,brush,rotate}.ts` · Size: M

- [ ] **Task 4: Split draw tool → `tools/draw/`**
      Convert `tools/draw.ts` (213) into `tools/draw/index.ts` (factory, gesture lifecycle) + `tools/draw/geometry.ts` (pure helpers: `perpendicularDistance`, `simplifyPath`, `getPathBounds`, `createPathElement`).
  - Acceptance: draw tool tests pass unchanged; `tools/draw/` files each < 250 lines
  - Verification: `pnpm test run packages/core/src/__tests__/line.test.ts` + `pnpm lint`
  - Deps: None · Files: `tools/draw.ts` → `tools/draw/{index,geometry}.ts` · Size: S

- [ ] **Task 5: Extract hit-testing → `elements/hit-test.ts`**
      Move `getElementAtPoint`, `pointToSegmentDistance`, `isPointInElement`, `getElementsBounds` (lines ~198–334 of `elements.ts`) into `elements/hit-test.ts`; `elements.ts` keeps factories + `measureTextSize` + move/resize/rotate and re-exports the moved functions.
  - Acceptance: `getElementAtPoint`/`getElementsBounds` still importable from `elements.ts` and `@adraw/core`; `elements.ts` < 250 lines
  - Verification: `pnpm test run packages/core/src/__tests__/elements.test.ts` + `pnpm lint`
  - Deps: None · Files: `elements.ts`, `elements/hit-test.ts` · Size: S

### Checkpoint: Phase 1 (Tasks 1–5)

- [ ] `pnpm lint` clean
- [ ] `pnpm test` — all 13 core test files pass unchanged
- [ ] `pnpm build:core` succeeds
- [ ] Human review before proceeding

### Phase 2: Engine extraction (headless core)

- [ ] **Task 6: Introduce `CanvasEngine`, compose it in `AdrawCanvas`**
      Create `src/engine/engine.ts` holding the pure-logic half of the class: state fields (elements, selectedIds, viewport, activeTool, snappingConfig, strokeColor, hideOverlayWhileTransforming, history, listeners, canvasSize, tools), `getToolContext`, event system (`on`/`off`/`emit`), and the logic-only public methods (`setCanvasSize`, `setActiveTool`, getters/setters, `insertMedia`, `selectAll`, `clearSelection`, `deleteSelected`, zoom family, `undo`/`redo`, `setElements`, `getTemporaryElement`). Add a `renderRequested` callback hook and `/** @internal */` accessors for later adapter use. `AdrawCanvas` constructs the engine, delegates these methods, and keeps all DOM code in place. File lands > 250 lines temporarily — trimming is Task 7–8.
  - Acceptance: headless test files pass unchanged (they construct `AdrawCanvas()` with no container); engine never imports DOM types
  - Verification: `pnpm test` + `pnpm lint` + `pnpm build:core`
  - Deps: 1–5 · Files: `canvas.ts`, `src/engine/engine.ts` · Size: M (mechanical move)

- [ ] **Task 7: Trim engine — `engine/media.ts`**
      Extract the `insertMedia` aspect-fit sizing math (lines ~458–543 of current `canvas.ts`) into a pure `computeMediaLayout(inputs, viewport, canvasSize)` in `src/engine/media.ts`; engine calls it.
  - Acceptance: `insertMedia` behavior identical (covered by existing canvas tests); every `engine/*` file < 250 lines after Task 8
  - Verification: `pnpm test run packages/core/src/__tests__/canvas.test.ts` + `pnpm lint`
  - Deps: 6 · Files: `engine/engine.ts`, `engine/media.ts` · Size: S

- [ ] **Task 8: Trim engine — `engine/selection.ts` + `engine/shortcuts.ts`**
      Move `selectAll`/`clearSelection`/`deleteSelected`/`zoomToFit` into `engine/selection.ts` and `handleKeyDown` into a pure `handleShortcutKey(event, api)` in `engine/shortcuts.ts`. Final size: `engine.ts` < 250 lines.
  - Acceptance: keyboard shortcuts and selection ops unchanged (existing tests); all `engine/*` files < 250 lines
  - Verification: `pnpm test` + `pnpm lint`
  - Deps: 6 · Files: `engine/{engine,selection,shortcuts}.ts` · Size: S

### Checkpoint: Engine (Tasks 6–8)

- [ ] `pnpm test` passes (headless suite green)
- [ ] `pnpm lint` + `pnpm build:core` clean
- [ ] Review the engine/adapter boundary contract (`renderRequested` + `@internal` accessors) with the human before building the adapter

### Phase 3: DOM adapter extraction

- [ ] **Task 9: Extract adapter core → `src/dom/adapter.ts`**
      Move mount/teardown machinery into `CanvasDomAdapter`: container/svg/groups/overlay node ownership, `mount`/`init`/`destroy`-side DOM setup, `setupEventListeners`, `getRelativePoint`, touch/pinch handling, `updateCursor`. Adapter wraps engine pointer/wheel events and subscribes to engine events to schedule renders. `AdrawCanvas.mount()` delegates; `handlePointer*`/`handleWheel` remain on the facade, delegating to the adapter.
  - Acceptance: mounted-mode e2e flows still work; `canvas.ts` < 900 lines; adapter file < 270 lines
  - Verification: `pnpm test run packages/core/src/__tests__/canvas.test.ts` + `pnpm test:e2e` (chromium project) + `pnpm lint`
  - Deps: 6–8 · Files: `canvas.ts`, `src/dom/adapter.ts`, `src/dom/events.ts` if split needed · Size: M

- [ ] **Task 10: Extract text editor → `src/dom/text-editor.ts`**
      Move the inline-editing lifecycle (`startTextEditing`, `startExistingTextEditing`, `openTextEditor`, `positionTextEditor`, `removeTextEditor`, `commitTextEditing`, `cancelTextEditing`, lines ~1170–1380) into module functions over (adapter, engine); engine gets the minimal `@internal` hooks needed to commit/cancel.
  - Acceptance: text editing behavior identical (text tests + manual check in `vite-vanilla`); `canvas.ts` < 500 lines
  - Verification: `pnpm test run packages/core/src/__tests__/text.test.ts` + `pnpm lint`
  - Deps: 9 · Files: `canvas.ts`, `src/dom/text-editor.ts` · Size: M

- [ ] **Task 11: Extract render machinery → `src/dom/render.ts`**
      Move `render`, `renderSelectionBox`, `ensureOverlayNodes`, `renderTransformOverlay`, `reconcileElements`, `renderTemporary`, `updateElementGeometry`, `renderSelectElements` (lines ~1397–1884) into `src/dom/render.ts`; if it exceeds 250 lines, split `renderTransformOverlay` + selection-box rendering into `src/dom/render/overlay.ts`. `canvas.ts` < 250 lines after this task.
  - Acceptance: rendering identical (transform-overlay + select tests, manual e2e spot-check); `canvas.ts` < 250 lines
  - Verification: `pnpm test run packages/core/src/__tests__/transform-overlay.test.ts` + `pnpm test:e2e` (chromium) + `pnpm lint`
  - Deps: 9–10 · Files: `canvas.ts`, `src/dom/render.ts`, `src/dom/render/overlay.ts` (if needed) · Size: M

- [ ] **Task 12: Finalize facade → `src/canvas.ts` + `src/options.ts`**
      Move option/event types (`CanvasOptions`, `AdrawCanvasOptions`, `ToImageOptions`, `MediaInput`, `CanvasEventMap`) to `src/options.ts`; `canvas.ts` becomes a pure delegation facade (~130 lines) re-exporting types, `pointsToPath`, `createElementGroup`. Run the API-compatibility gate.
  - Acceptance: `dist/index.d.ts` diff vs pre-refactor build is empty; every `packages/core/src` non-test file < 250 lines (except `elements.ts`… must recheck: ~224 after Task 5)
  - Verification: `pnpm build:core`, diff `dist/index.d.ts` against a pre-refactor build, `pnpm test` (full), `pnpm lint`
  - Deps: 9–11 · Files: `canvas.ts`, `src/options.ts` · Size: S

### Checkpoint: Adapter (Tasks 9–12)

- [ ] Full `pnpm test` green
- [ ] `pnpm build:all` clean; `dist/index.d.ts` identical to pre-refactor
- [ ] `pnpm test:e2e` — full Playwright suite (chromium + firefox + webkit via distrobox)
- [ ] Human review of final structure before bindings phase

### Phase 4: Framework bindings

- [ ] **Task 13: Split React hooks → `react/src/hooks.ts`**
      Move context + 6 hooks (`useCanvas`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useTransformOverlay`, lines ~25–225 of `components.tsx`) into `src/hooks.ts`; `components.tsx` keeps `CanvasProvider` + `Canvas`; package index re-exports both.
  - Acceptance: `vite-react` example runs; `components.tsx` and `hooks.ts` each < 250 lines
  - Verification: `pnpm --filter=@adraw/react build` + `pnpm lint` + manual run of `examples/vite-react`
  - Deps: 12 · Files: `react/src/components.tsx`, `react/src/hooks.ts` · Size: S

- [ ] **Task 14: Split Solid hooks → `solid/src/hooks.ts`**
      Same extraction for Solid (`useCanvas`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useTransformOverlay`).
  - Acceptance: `vite-solid` example runs; both files < 250 lines
  - Verification: `pnpm --filter=@adraw/solid build` + `pnpm lint` + manual run of `examples/vite-solid`
  - Deps: 12 · Files: `solid/src/components.tsx`, `solid/src/hooks.ts` · Size: S

### Checkpoint: Complete (Tasks 13–14)

- [ ] All acceptance criteria met
- [ ] `pnpm lint`, `pnpm test`, `pnpm build:all`, `pnpm test:e2e` all green
- [ ] `examples/vite-react` and `examples/vite-solid` render and interact correctly
- [ ] Ready for human review

## Risks and Mitigations

| Risk                                                                                               | Impact | Mitigation                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Private-member access across the engine/adapter boundary (text-edit commit needs engine internals) | Med    | Narrow `/** @internal */` accessors on `CanvasEngine`, reviewed at the engine checkpoint (after Task 8) before the adapter is built |
| Public API drift (`dist/index.d.ts` changes)                                                       | High   | Facade re-exports everything; byte-diff gate at Task 12 checkpoint; do a pre-refactor baseline build before starting                |
| Circular imports `engine ↔ dom`                                                                    | Med    | One-directional rule: `dom/* → engine/*`; adapter registers `renderRequested` callback; lint rule to enforce                        |
| Import-path churn from directory restructure (`./select` → `tools/select/`)                        | Low    | Directory-index resolution keeps `./select` valid; barrel `tools/index.ts` unchanged                                                |
| Regressions in pointer/wheel/text-editing behavior                                                 | Med    | Existing e2e suite (Playwright, real DOM events) + per-task targeted unit tests; run e2e early in Task 9                            |
| `elements.ts` or `engine.ts` still > 250 after trim                                                | Low    | Follow-up micro-splits budgeted (Task 11's `render/overlay.ts`, Task 8's selection/shortcuts)                                       |

## Open Questions

- [ ] **Small flat tools:** convert `ellipse.ts`, `rectangle.ts`, `line.ts`, `text.ts`, `eraser.ts`, `hand.ts` to `tools/{tool}/index.ts` directories now for uniform layout, or leave flat until they approach 250 lines? (Plan assumes leave flat.)
