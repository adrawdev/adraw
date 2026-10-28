# AGENTS.md — @adraw/core

## Purpose

Framework-agnostic core canvas engine. Pure logic (elements, viewport, tools, history, snapping) plus a DOM adapter that renders to SVG. Can run headless (no DOM) for testing.

## Build & test

```bash
pnpm core:build    # build
pnpm core:dev      # watch mode
pnpm test          # from root — Vitest includes packages/**/*
pnpm test run packages/core/src/__tests__/coordinates.test.ts  # single file
```

## Main entry point: `AdrawCanvas` class

`src/canvas.ts` defines `AdrawCanvas extends CanvasEngine` — the engine is the base class (state, tools, history, state notifier), and this subclass composes the DOM adapter (`src/dom/`). Constructed headless or with a container:

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
  canvas.ts          AdrawCanvas extends CanvasEngine — adds mount/render/destroy + DOM event handling
  options.ts         CanvasOptions, AdrawCanvasOptions, MediaInput, ToImageOptions
  text.ts            TextMeasurer, measureTextLayout, wrapping + line/anchor helpers
  arrow-bindings.ts  arrow-to-element binding/synchronization math
  text-bindings.ts   bound text: max width/height, centering, container growth, sync
  groups.ts          group hierarchy, bounds sync, selection levels, group/ungroup math
  style.ts           style types and global defaults
  store.ts           AdrawStore / AdrawSnapshot: state snapshots for adapters
  engine/            headless core (no DOM imports)
    engine.ts        CanvasEngine: state, notifier, getToolContext, public API, @internal accessors
    scene.ts         Scene: elements, selection, history, binding sync, atomic commits
    state-notifier.ts internal operation-scoped state publications
    style.ts        applyStyleToElement/getElementStyle: style write-back and read-back
    clipboard.ts     ClipboardManager + copy/paste element math (group expansion, id remap)
    media.ts         insertMedia sizing math (createMediaElements)
    selection.ts     selectAllIds, deleteSelectedElements
    z-order.ts       bringToFront / sendToBack / setZIndex math
    shortcuts.ts     handleShortcutKey (pure keyboard-shortcut function)
    internal.ts      text-editing + overlay hooks over CanvasEngine
    pointer.ts       screen→canvas dispatch, wheel zoom/pan (headless pointer paths)
  dom/               DOM adapter (imports engine/*, never the reverse)
    adapter.ts       mountDom: SVG layers, state-notifier wiring, destroy
    events.ts        setupEventListeners (pointer/wheel/dblclick/cursor/keyboard)
    touch.ts         pinch/touch listeners
    pointer.ts       mounted pointer handlers + getRelativePoint
    text-editor.ts   inline <textarea> editing lifecycle
    text-measure.ts  canvas-backed TextMeasurer installed on mount
    text-target.ts   resolves text-tool clicks and creates bound text
    render.ts        renderAll, renderTemporary, updateElementGeometry, positionTextEditor
    render/elements.ts     reconcileElements, renderSelectElements
    render/guides.ts       renderGuides (alignment guides)
    render/overlay.ts      renderTransformOverlay
    render/overlay-nodes.ts ensureOverlayNodes, renderSelectionBox
    to-image.ts       toImage
    svg.ts            pure SVG node helpers + CSS-class constants
    state.ts          DomState (mutable DOM adapter state)
  elements/          factories (elements.ts) + hit-testing (hit-test.ts)
  tools/<tool>/      one directory per tool; index.ts exports the factory
  tools/select/      brush, move, rotate, resize, resize-rotated, resize-text
  tools/note/        sticky-note tool (click places, drag sizes, N shortcut)
  note.ts           sticky-note text layout, fold size, padding helpers
  tools/snap.ts      snapToolPoint: pointer snapping for tool gestures
  coordinates.ts, history.ts, snapping.ts, viewport.ts, types.ts, constants.ts
```

Rules: `dom/*` and `engine/*` never import each other cyclically. `engine/internal.ts` and `engine/pointer.ts` type against `CanvasEngine`; the engine stays DOM-free, and the adapter subscribes to the internal state notifier and renders.

Public exports beyond the `AdrawCanvas` API (via `src/index.ts`): `CanvasEngine` (headless core, usable on its own), `AdrawStore` / `AdrawSnapshot` (adapter-facing state), and the tool contracts `Tool` / `ToolContext` — exported because `AdrawCanvas extends CanvasEngine` puts them in the public class signature.

### Key methods

| Method                                                  | Description                                               |
| ------------------------------------------------------- | --------------------------------------------------------- |
| `mount(container)`                                      | Attach DOM adapter to an element                          |
| `destroy()`                                             | Tear down DOM, remove event listeners                     |
| `render()`                                              | Full re-render of the SVG                                 |
| `getElements()`                                         | Get current elements `Map<ElementId, CanvasElement>`      |
| `setActiveTool(tool)`                                   | Switch active tool                                        |
| `getActiveTool()`                                       | Get current tool `ToolType`                               |
| `setViewport(vp)`                                       | Set viewport position/zoom                                |
| `getViewport()`                                         | Current viewport `{ x, y, zoom }`                         |
| `zoomIn()` / `zoomOut()`                                | Zoom by ZOOM_STEP                                         |
| `resetZoom()`                                           | Reset zoom to 1, center to 0,0                            |
| `zoomToFit(options?)`                                   | Fit all elements (or explicit bounds/padding) in viewport |
| `selectAll()` / `clearSelection()` / `deleteSelected()` | Selection operations                                      |
| `group()` / `ungroup()`                                 | Group the selection / remove one group level              |
| `bringToFront(ids)` / `sendToBack(ids)`                 | Restack elements (groups carry their children)            |
| `setZIndex(id, z)`                                      | Set one element's exact stacking index                    |
| `copy()` / `cut()` / `paste(point?)`                    | Clipboard operations (Ctrl/Cmd+C/X/V)                     |
| `serializeClipboard()` / `deserializeClipboard(text)`   | Bridge the clipboard to/from serialized text              |
| `undo()` / `redo()`                                     | History navigation                                        |
| `canUndo()` / `canRedo()`                               | History stack state                                       |
| `pushHistory()`                                         | Record an explicit undo checkpoint                        |
| `clearHistory()`                                        | Reset history with the current state as new baseline      |
| `withoutHistory(fn)`                                    | Run `fn` without recording checkpoints                    |
| `getSelectedIds()`                                      | `Set<ElementId>` of selected elements                     |
| `getStyle()`                                            | Selection style or global defaults                        |
| `setStyle(partial)`                                     | Merge global styles; restyles selected elements           |
| `getHideOverlayWhileTransforming()`                     | Transform overlay visibility                              |
| `setHideOverlayWhileTransforming(bool)`                 | Control transform overlay                                 |
| `getIsToolLocked()`                                     | Whether tools stay active after creating an element       |
| `setIsToolLocked(bool)`                                 | Control the post-creation tool switch                     |

### State observation

Public state is read through `AdrawStore` / `AdrawSnapshot`:

```ts
import { AdrawStore } from "@adraw/core"

const store = new AdrawStore(canvas)
const unsubscribe = store.subscribe(() => {
  const snapshot = store.getSnapshot()
  // snapshot.elements, selectedIds, selectedElements, viewport, tool,
  // canUndo/canRedo, style, snapping, isSnapMode, isToolLocked,
  // hideWhileTransforming, isReady
})
unsubscribe()
store.dispose()
```

The engine has no public `on`/`off`/`emit`; the DOM adapter and the store share one internal state notifier. Each completed canvas operation publishes at most one deduplicated set of changed kinds. Nested calls fold into the outer operation; async `withoutHistory` publishes at its synchronous boundaries, including the final history update. Snapshot maps and sets are copies, unchanged slices are reused, and no-op operations do not publish.

Listener collections are captured at publication start. Listener errors do not prevent later delivery; the operation error wins, otherwise the first listener error is rethrown after dispatch. Failed operations publish the state that remains before rethrowing, without adding operation rollback.

### Scene

`src/engine/scene.ts` owns elements, selection and undo history. Scene operations go through `Scene.commit` (atomic copy), `Scene.replace` (caller-built map) or `Scene.select` (selection only); each returns a `SceneChange` that the engine composes with non-Scene changes into one operation-scoped State publication. Commits and replacements sync arrow and bound-text bindings, keep group bounds/z-index in sync and clamp the selection. Checkpoints are opt-in with `{ history: true }`; `withoutHistory` lives on the scene. The engine keeps viewport, tool, style, snapping, clipboard storage and the text measurer.

### Groups

`src/groups.ts` owns the group hierarchy: parent lookups, effective visibility/lock, selection-level normalization, derived bounds/z-index sync, group/ungroup math and context fallback. A group is a container, not a rendered element; its bounds come from visible descendants. The select tool keeps an entered-group context (`ToolContext.getGroupContext` / `setGroupContext`), and the DOM adapter renders a dashed outline around it. `Ctrl/Cmd+G` groups the current selection, `Ctrl/Cmd+Shift+G` ungroups one level, and `Escape` steps out of an entered group. The eraser resolves the hit to the outermost group and deletes its whole subtree.

### Config

Passed to constructor as `CanvasOptions`:

- `container?: HTMLElement`
- `initialViewport?: ViewportState`
- `viewport?: Partial<ViewportConfig>` — `{ minZoom, maxZoom, zoomSensitivity, fitPadding, constrainToContent }`; applies to wheel zoom, `zoomIn`/`zoomOut`, `resetZoom`, `setViewport` and `zoomToFit`. `constrainToContent` clamps panning to the content and floors zoom at the last `zoomToFit()` level
- `hideOverlayWhileTransforming?: boolean`
- `isToolLocked?: boolean` — lock the rectangle/ellipse/diamond/line/arrow/text/note tool so it stays active after creating an element instead of switching to `select`; created elements are left unselected. Toggle at runtime with `setIsToolLocked()` / read with `getIsToolLocked()`, or press `Q` while the canvas is focused
- `snapping?: SnappingConfig` (`{ threshold }`)
- `isSnapMode?: boolean` — snap by default; when false/omitted, snapping needs Ctrl/Cmd held
- `keyboard?: "canvas" | "document" | "none"` — shortcut scope; defaults to `"canvas"` (SVG is focusable and focuses on pointer down), `"document"` handles shortcuts page-wide, `"none"` disables them
- `clipboard?: ClipboardOptions` — `{ serialize?, deserialize? }` hooks bridging the in-memory clipboard to the system clipboard
- `measureText?: TextMeasurer` — text layout measurer. Defaults to a character-count approximation; `AdrawCanvas.mount` installs a canvas-backed one unless this option is supplied. Set it later with `setTextMeasurer()` / read it with `getTextMeasurer()`.

### Tool styles

`src/style.ts` defines `StyleOptions` and the built-in `DEFAULT_STYLE`. Styles are global: the engine stores the values set with `setStyle(partial)`, tools merge them over their own factory defaults for future gestures, and `setStyle` restyles the selected elements (fields an element does not support are ignored). `getStyle()` reads the selected elements' common style, falling back to `DEFAULT_STYLE` overlaid with the global values. Shared options are `strokeColor`, `strokeWidth` and `opacity`; `fillColor` affects rectangles, ellipses, diamonds and notes. Text adds `fontSize`, `fontFamily`, `textAlign`, `lineHeight` and `autoSize`; paths add `smoothing`; rectangles and notes add `cornerRadius`. Tools read live style through `ToolContext.getStyle()` (optional for standalone factories, with `getStyleForContext()` in `tools/base.ts` as the fallback helper).

### Text layout

`src/text.ts` owns text measurement and wrapping. `TextMeasurer` receives `TextLayoutOptions` (`fontSize`, `fontFamily`, `lineHeight`, `autoSize`, `maxWidth`) and returns `{ width, height, lines }`. The built-in `approximateTextMeasurer` uses ~0.6em per character so headless tests are deterministic; `measureTextLayout()` exposes the same algorithm with an injectable line measurer. `measureTextElement()` applies an element's style to its measurer. `appendTextLines()` renders one `<tspan>` per line with the element's alignment and a half-leading that matches the HTML editor's line boxes.

`AdrawCanvas.mount()` calls `setAdapterTextMeasurer(createCanvasTextMeasurer(document))`, which re-measures existing text; `destroy()` restores the approximation. `setTextMeasurer(fn)` also re-measures every text element without adding a history entry.

Text editing follows Excalidraw semantics: double-click or `Enter`/`F2` on a selected text starts editing, the text tool edits an existing text under the pointer, `Enter` inserts a newline, and `Escape` / `Ctrl`/`Cmd+Enter` confirms the edit. Opening an editor clears the selection and normally switches the active tool to `select`; with `isToolLocked` on, the text or note tool stays active, and clicking outside the editor confirms it and starts the next element in the same click. Confirming selects the edited text (or its container for bound text). The overlay reuses the element's unscaled font, `lineHeight`, alignment and box, applying viewport zoom and rotation with a CSS transform. Dragging the left/right resize handle switches to fixed-width wrapping; corners and top/bottom edges scale `fontSize`.

`src/text-bindings.ts` handles bound text attached to a rectangle, ellipse, diamond or arrow. Bound text has a `containerId`; `syncTextBindings()` re-wraps it to the container's inner width (`wrapWidth`), sizes the box to the longest wrapped line, centers it, matches the container's rotation/visibility and grows the container vertically when the bound text no longer fits. Arrows use `labelPosition` (0–1) and auto-size bound text; `getBoundTextBounds()` feeds the arrow renderer, which splits the shaft around the bound-text box so the line does not cross the text. `syncBindings()` in the engine runs arrows first, then bound text, then arrows again when a container grew; it also removes bound text whose container disappeared. The DOM creates bound text through `dom/text-target.ts` (`startBoundTextEditing`), creates double-click free text through `startFreeTextEditing`, and drags fixed-width free text through the text tool's pending gesture in `dom/pointer.ts`.

## Type system

Defined in `src/types.ts`.

### Element types

All extend `BaseElement` (id, type, x, y, width, height, rotation, zIndex, locked, visible, opacity?):

| Type          | Interface          | Extra fields                                                                                                                 |
| ------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `"rectangle"` | `RectangleElement` | `cornerRadius`, `strokeWidth`, `strokeColor`, `fillColor?`                                                                   |
| `"ellipse"`   | `EllipseElement`   | `strokeWidth`, `strokeColor`, `fillColor?`                                                                                   |
| `"diamond"`   | `DiamondElement`   | `strokeWidth`, `strokeColor`, `fillColor?`                                                                                   |
| `"line"`      | `LineElement`      | `startX/Y`, `endX/Y`, `strokeWidth`, `strokeColor`                                                                           |
| `"arrow"`     | `ArrowElement`     | `startX/Y`, `endX/Y`, `strokeWidth`, `strokeColor`, `startArrowhead?`, `endArrowhead?`, `startBinding?`, `endBinding?`       |
| `"path"`      | `PathElement`      | `points[]`, `strokeWidth`, `strokeColor`, `smoothing?` (paths are never filled)                                              |
| `"media"`     | `MediaElement`     | `src`, `mimeType`, `naturalWidth/Height`                                                                                     |
| `"group"`     | `GroupElement`     | `children: ElementId[]` (bounds and z-index are derived and kept in sync)                                                    |
| `"text"`      | `TextElement`      | `text`, `fontSize`, `strokeColor`, `fontFamily?`, `textAlign?`, `lineHeight?`, `autoSize?`, `containerId?`, `labelPosition?` |
| `"note"`      | `NoteElement`      | `text`, `fontSize`, `fillColor`, `strokeColor` (ink), `fontFamily?`, `textAlign?`, `lineHeight?`, `padding`, `cornerRadius`  |

`opacity` (0–1) is rendered on the element's SVG group, so it fades stroke and fill together. `fillColor` only exists on rectangles, ellipses and diamonds; omitting it uses the `--adraw-fill` CSS variable (transparent).

### Tool types

`"select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "diamond" | "line" | "arrow" | "text" | "note"`

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
  getBindingCandidate?(): ElementId | null
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
- `getElementBounds(x, y, width, height, rotation?)` — axis-aligned `BoundingBox` accounting for rotation
- `pointInBounds(point, bounds)` — point-in-rect test
- `distanceBetweenPoints(a, b)` — Euclidean distance
- `clamp(value, min, max)`
- `generateId()` — unique ID string

## Element factories

File: `src/elements.ts`. Each returns a typed element with an auto-generated ID:

```ts
createRectangle({ x, y, width, height, cornerRadius?, rotation? })
createEllipse({ x, y, width, height })
createDiamond({ x, y, width, height })
createLine({ startX, startY, endX, endY })
createPath({ points, smoothing? })
createMedia({ src, mimeType, naturalWidth, naturalHeight })
createGroup({ children })
cloneElement(element, overrides?)
```

Also: `moveElement`, `resizeElement`, `rotateElement`. Hit-testing and selection bounds live in `src/elements/hit-test.ts`: `getElementAtPoint`, `getElementsBounds` (re-exported from `elements.ts`).

## History

File: `src/history.ts`. Stack-based undo/redo. `pushHistory()` records the current state as a checkpoint, and `undo()`/`redo()` restore elements and publish the change.

Programmatic changes can stay out of history: `addElement`, `insertMedia`, `loadDocument` and `setElements` accept `{ history: false }`, and `withoutHistory(fn)` suppresses every checkpoint pushed inside `fn` (nested calls coalesce). Changes made outside history are folded into existing checkpoints, so undo/redo never drops them. Use `clearHistory()` after loading or initializing a document to make the current state the new undo baseline; it notifies state subscribers so history availability refreshes. `pushHistory()` is a no-op inside `withoutHistory`.

## Clipboard

`src/engine/clipboard.ts`. Each engine owns an in-memory `ClipboardManager`. `copy()`/`cut()` snapshot the selected elements — recursively including group children — and `paste(point?)` inserts fresh-ID clones (group references remapped) centered on `point`, defaulting to the last pointer position and then the viewport center. Pasting is a single undo step and selects the clones. `Ctrl/Cmd+C/X/V` map to the same operations. `serializeClipboard()` / `deserializeClipboard(text)` bridge the buffer to the system clipboard: the default format is an `{ type: "adraw/clipboard", version: 1, elements }` JSON envelope, replaceable via `new AdrawCanvas({ clipboard: { serialize, deserialize } })`.

## Snapping

File: `src/snapping.ts`. Config via `SnappingConfig` (`threshold`). `isSnapActive()` reports whether `isSnapMode` is on or Ctrl/Cmd is held; `snapBoundsToElements()` snaps moved selection bounds and `snapPointToElements()` snaps a resize/drawing point, both returning `SnapGuide`s. Tools publish active guides through `ToolContext.setSnapGuides()`; `engine/pointer.ts` clears them on pointer down/up. `getSnapGuides()` exposes them on the engine.

## Rendering

The DOM adapter renders to an `<svg>` with three `<g>` child layers: `.adraw-elements-group`, `.adraw-guides-group` (snap alignment guides) and the transform overlay. Rendering is incremental (never `innerHTML = ""`):

- `src/dom/render.ts` — `renderAll()` (full render: temporary element, snap guides, transform overlay, marquee, editor position), `renderTemporary()`, `updateElementGeometry()`, `positionTextEditor()`
- `src/dom/render/elements.ts` — `reconcileElements()` (DOM diff for non-select tools), `renderSelectElements()` (DOM diff for select tool, only re-geometries selected)
- `src/dom/render/guides.ts` — `renderGuides()` (pooled guide lines, viewport-spanning)
- `src/dom/render/overlay.ts` — `renderTransformOverlay()`
- `src/dom/render/overlay-nodes.ts` — `ensureOverlayNodes()`, `renderSelectionBox()` (persistent nodes, updated in place)
- `src/dom/render/plan.ts` — `planStateRender()` maps one State publication's changed kinds to a deduplicated, fixed-order render plan

The adapter subscribes to the internal state notifier and renders at most one plan per State publication; the mount layer owns the `onToolWillChange` callback the engine invokes. Direct `renderAll()` calls from DOM gesture handlers remain a separate transient-invalidation path.

Styling via CSS custom properties: `--adraw-stroke`, `--adraw-fill`, `--adraw-background`, `--adraw-selection`. Defaults in `src/constants.ts`.

## Tests

Unit tests are in `src/__tests__/`:

```
clipboard.test.ts              — copy/cut/paste, pointer placement, serialization hooks
arrow.test.ts                  — arrow tool, bindings, endpoint drag, clipboard remap
groups.test.ts                 — group/ungroup, drill-down, transforms, eraser, inherited flags
coordinates.test.ts            — screenToCanvas, canvasToScreen, bounds, hit-test
elements.test.ts               — factory functions, clone, move, resize, rotate
history.test.ts                — undo/redo stack
scene.test.ts                  — atomic scene commits, history, binding sync, selection clamping
store.test.ts                  — AdrawStore snapshots, slice reuse, readiness and disposal
state-notifier.test.ts         — operation scopes, dispatch, listener snapshots and error precedence
operation-publication.test.ts  — coherent store publications across gestures, failures and async boundaries
operation-matrix.test.ts       — publication count and changed kinds for every public mutating entry
dom-render-plan.test.ts        — deduplicated DOM work per State publication
line.test.ts                   — line tool
select-brush.test.ts           — marquee selection
select-deactivate.test.ts      — select deactivation
select-flip.test.ts            — flip/transform
select-transform-state.test.ts — isResizing, isRotating
snapping.test.ts               — snapping math
snapping-dom.test.ts           — snap guide DOM rendering
snapping-gestures.test.ts      — move/resize/create snapping via headless canvas
text.test.ts                  — text tool, measurement, hit-testing, resize
text-layout.test.ts           — measureTextLayout, wrapping, alignment helpers
text-bindings.test.ts         — bound text, growth, clipboard, z-order
text-dom.test.ts              — inline editor, drag-to-create, bound text
transform-overlay.test.ts      — transform overlay
viewport.test.ts               — zoom, pan, zoomToFit
viewport-config.test.ts        — CanvasOptions.viewport, constraints, fit bounds
```

Run with `pnpm test` from root or `pnpm test run packages/core/src/__tests__/coordinates.test.ts`.

## Code style

- No trailing semicolons, double quotes, 2-space indent
- `import type { ... }` for type-only imports
- `_` prefix for unused parameters
- No comments unless genuinely non-obvious
- Reference constants from `src/constants.ts` not inline CSS-var strings
