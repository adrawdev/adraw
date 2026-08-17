# AGENTS.md — @adraw/core

## Purpose

Framework-agnostic core canvas engine. Pure logic (elements, viewport, tools, history, snapping) plus a DOM adapter that renders to SVG. Can run headless (no DOM) for testing.

## Build & test

```bash
pnpm build:core    # tsdown --minify → dist/{index.js,index.cjs,index.d.ts}
pnpm dev:core      # watch mode
pnpm test          # from root — Vitest includes packages/**/*
pnpm test run packages/core/src/__tests__/coordinates.test.ts  # single file
```

## Main entry point: `AdrawCanvas` class

`src/canvas.ts` is a facade that composes two parts — the headless `CanvasEngine` (`src/engine/engine.ts`) and the DOM adapter (`src/dom/`). Constructed headless or with a container:

```ts
import { AdrawCanvas } from "@adraw/core"

// headless (for SSR / testing) — engine only, no DOM
const canvas = new AdrawCanvas()

// with container (auto-mounts to DOM — engine + DOM adapter)
const canvas = new AdrawCanvas({ container: divElement })
```

### Source layout

```
src/
  canvas.ts          facade — composes engine + DOM adapter, delegates every public method
  options.ts         CanvasOptions, AdrawCanvasOptions, MediaInput, CanvasEventMap, ToImageOptions
  engine/            headless core (no DOM imports)
    engine.ts        CanvasEngine: state, events, getToolContext, public API, @internal accessors
    media.ts         insertMedia sizing math (createMediaElements)
    selection.ts     selectAllIds, deleteSelectedElements, computeZoomToFitViewport
    shortcuts.ts     handleShortcutKey (pure keyboard-shortcut function)
    internal.ts      text-editing + overlay hooks over EngineInternal
    pointer.ts       screen→canvas dispatch, wheel zoom/pan (headless pointer paths)
  dom/               DOM adapter (imports engine/*, never the reverse)
    adapter.ts       mountDom: SVG layers, engine event wiring, destroy
    events.ts        setupEventListeners (pointer/wheel/dblclick/cursor/keyboard)
    touch.ts         pinch/touch listeners
    pointer.ts       mounted pointer handlers + getRelativePoint
    text-editor.ts   inline <textarea> editing lifecycle
    render.ts        renderAll, renderTemporary, updateElementGeometry, positionTextEditor
    render/elements.ts     reconcileElements, renderSelectElements
    render/overlay.ts      renderTransformOverlay
    render/overlay-nodes.ts ensureOverlayNodes, renderSelectionBox
    to-image.ts       toImage
    svg.ts            pure SVG node helpers + CSS-class constants
    state.ts          DomState (mutable DOM adapter state)
  elements/          factories (elements.ts) + hit-testing (hit-test.ts)
  tools/<tool>/      one directory per tool; index.ts exports the factory
  coordinates.ts, history.ts, snapping.ts, viewport.ts, types.ts, constants.ts
```

Rules: `dom/*` and `engine/*` never import each other cyclically — `engine.ts` exports the narrow `EngineInternal` interface that `engine/internal.ts` / `engine/pointer.ts` and the DOM modules consume. The engine stays DOM-free; the adapter subscribes to engine events and renders.

### Key methods

| Method                                                  | Description                                          |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `mount(container)`                                      | Attach DOM adapter to an element                     |
| `destroy()`                                             | Tear down DOM, remove event listeners                |
| `render()`                                              | Full re-render of the SVG                            |
| `getElements()`                                         | Get current elements `Map<ElementId, CanvasElement>` |
| `setActiveTool(tool)`                                   | Switch active tool                                   |
| `getActiveTool()`                                       | Get current tool `ToolType`                          |
| `setViewport(vp)`                                       | Set viewport position/zoom                           |
| `getViewport()`                                         | Current viewport `{ x, y, zoom }`                    |
| `zoomIn()` / `zoomOut()`                                | Zoom by ZOOM_STEP                                    |
| `resetZoom()`                                           | Reset zoom to 1, center to 0,0                       |
| `zoomToFit()`                                           | Fit all elements in viewport                         |
| `selectAll()` / `clearSelection()` / `deleteSelected()` | Selection operations                                 |
| `undo()` / `redo()`                                     | History navigation                                   |
| `canUndo()` / `canRedo()`                               | History stack state                                  |
| `getSelectedIds()`                                      | `Set<ElementId>` of selected elements                |
| `getHideOverlayWhileTransforming()`                     | Transform overlay visibility                         |
| `setHideOverlayWhileTransforming(bool)`                 | Control transform overlay                            |

### Events

`canvas.on(event, handler)` / `canvas.off(event, handler)` — emitted by the engine:

| Event               | Payload                                       |
| ------------------- | --------------------------------------------- |
| `"change"`          | `{ elements: Map<ElementId, CanvasElement> }` |
| `"viewportChange"`  | `{ viewport: ViewportState }`                 |
| `"toolChange"`      | `{ tool: ToolType }`                          |
| `"selectionChange"` | `{ selectedIds: Set<ElementId> }`             |

Always copy the payload when storing (`new Map(elements)`, `new Set(selectedIds)`).

### Config

Passed to constructor as `CanvasOptions`:

- `container?: HTMLElement`
- `initialViewport?: ViewportState`
- `hideOverlayWhileTransforming?: boolean`
- `snapping?: SnappingConfig`

## Type system

Defined in `src/types.ts`.

### Element types

All extend `BaseElement` (id, type, x, y, width, height, rotation, zIndex, locked, visible):

| Type          | Interface          | Extra fields                                           |
| ------------- | ------------------ | ------------------------------------------------------ |
| `"rectangle"` | `RectangleElement` | `cornerRadius`                                         |
| `"ellipse"`   | `EllipseElement`   | —                                                      |
| `"line"`      | `LineElement`      | `startX/Y`, `endX/Y`, `strokeWidth`, `strokeColor`     |
| `"path"`      | `PathElement`      | `points[]`, `strokeWidth`, `strokeColor`, `smoothing?` |
| `"media"`     | `MediaElement`     | `src`, `mimeType`, `naturalWidth/Height`               |
| `"group"`     | `GroupElement`     | `children: ElementId[]`                                |
| `"text"`      | `TextElement`      | `text`, `fontSize`, `strokeColor`                      |

### Tool types

`"select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "line" | "text"`

### Coordinate types

`Point { x, y }`, `Size { width, height }`, `BoundingBox { x, y, width, height }`, `ViewportState { x, y, zoom }`.

## Tool system

Each tool lives in `src/tools/<tool>/` and its `index.ts` exports a factory function (e.g. `createSelectTool()`). Tools with separable logic split further: `tools/select/` has `brush.ts`, `rotate.ts`, `resize.ts`, `resize-rotated.ts`, `move.ts`, `state.ts`; `tools/draw/` has `geometry.ts`. Implement the `Tool` interface from `src/tools/base.ts`:

```ts
interface Tool {
  readonly type: ToolType
  readonly cursor: string
  onActivate(ctx: ToolContext): void
  onDeactivate(ctx: ToolContext): void
  onPointerDown(ctx: ToolContext, point: Point, event: PointerEvent): void
  onPointerMove(ctx: ToolContext, point: Point, event: PointerEvent): void
  onPointerUp(ctx: ToolContext, point: Point, event: PointerEvent): void
  getTemporaryElement(): CanvasElement | null
  getSelectionBox?(): BoundingBox | null
  isResizing?(): boolean
  isRotating?(): boolean
}
```

`ToolContext` provides getters/setters — never mutate canvas state directly. Use `createBaseToolState()` for state tracking. Use `getDefaultToolOptions()` for default colors/stroke.

### Adding a new tool

1. Create `src/tools/<name>/index.ts` exporting `create<Name>Tool(): Tool`
2. Export it from `src/tools/index.ts`
3. Add it to the `ToolType` union in `src/types.ts`
4. Register it in the tool factory map in `src/engine/engine.ts` (constructor)
5. Add keyboard shortcut handling in `src/engine/shortcuts.ts` if needed
6. Update e2e tests if applicable

## Coordinate utilities

File: `src/coordinates.ts`.

- `screenToCanvas(screenPoint, viewport, canvasSize)` — convert screen coords to canvas space
- `canvasToScreen(canvasPoint, viewport, canvasSize)` — reverse
- `getElementBounds(element)` — get `BoundingBox` accounting for rotation
- `pointInBounds(point, bounds)` — point-in-rect test
- `distanceBetweenPoints(a, b)` — Euclidean distance
- `clamp(value, min, max)`
- `generateId()` — unique ID string

## Element factories

File: `src/elements.ts`. Each returns a typed element with an auto-generated ID:

```ts
createRectangle({ x, y, width, height, cornerRadius?, rotation? })
createEllipse({ x, y, width, height })
createLine({ startX, startY, endX, endY })
createPath({ points, smoothing? })
createMedia({ src, mimeType, naturalWidth, naturalHeight })
createGroup({ children })
cloneElement(element, overrides?)
```

Also: `moveElement`, `resizeElement`, `rotateElement`. Hit-testing and selection bounds live in `src/elements/hit-test.ts`: `getElementAtPoint`, `getElementsBounds` (re-exported from `elements.ts`).

## History

File: `src/history.ts`. Stack-based undo/redo. Call `pushHistory()` before each mutation. `undo()`/`redo()` restore elements and trigger a `"change"` event.

## Snapping

File: `src/snapping.ts`. Config via `SnappingConfig`. `calculateSnap()` snaps a point to element edges/centers. `snapBoundsToElements()` snaps element bounds during resize/move.

## Rendering

The DOM adapter renders to an `<svg>` with two `<g>` child layers: `.adraw-elements-group` and transform overlay. Rendering is incremental (never `innerHTML = ""`):

- `src/dom/render.ts` — `renderAll()` (full render: temporary element, transform overlay, marquee, editor position), `renderTemporary()`, `updateElementGeometry()`, `positionTextEditor()`
- `src/dom/render/elements.ts` — `reconcileElements()` (DOM diff for non-select tools), `renderSelectElements()` (DOM diff for select tool, only re-geometries selected)
- `src/dom/render/overlay.ts` — `renderTransformOverlay()`
- `src/dom/render/overlay-nodes.ts` — `ensureOverlayNodes()`, `renderSelectionBox()` (persistent nodes, updated in place)

The adapter subscribes to the engine's four events and renders on change; the mount layer owns the `renderRequested` and `onToolWillChange` callbacks the engine invokes.

Styling via CSS custom properties: `--adraw-stroke`, `--adraw-fill`, `--adraw-background`, `--adraw-selection`. Defaults in `src/constants.ts`.

## Tests

Unit tests are in `src/__tests__/`:

```
coordinates.test.ts            — screenToCanvas, canvasToScreen, bounds, hit-test
elements.test.ts               — factory functions, clone, move, resize, rotate
history.test.ts                — undo/redo stack
line.test.ts                   — line tool
select-brush.test.ts           — marquee selection
select-deactivate.test.ts      — select deactivation
select-flip.test.ts            — flip/transform
select-transform-state.test.ts — isResizing, isRotating
snapping.test.ts               — snapping math
text.test.ts                  — text tool, measurement, hit-testing
transform-overlay.test.ts      — transform overlay
viewport.test.ts               — zoom, pan, zoomToFit
```

Run with `pnpm test` from root or `pnpm test run packages/core/src/__tests__/coordinates.test.ts`.

## Code style

- No trailing semicolons, double quotes, 2-space indent
- `import type { ... }` for type-only imports
- `_` prefix for unused parameters
- No comments unless genuinely non-obvious
- Reference constants from `src/constants.ts` not inline CSS-var strings
