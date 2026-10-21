# @adraw/core

## 0.5.0

### Minor Changes

- [`095d354`](https://github.com/adrawdev/adraw/commit/095d354e84372e41fb9cc7d00954c320d215fc8e) Add `addElement`, `loadDocument`, `toDocument` (and `toJSON`/`setElements`) to `CanvasEngine` so saved documents (paths, arrows, texts) can be restored with history and events.

- [`3fb901e`](https://github.com/adrawdev/adraw/commit/3fb901e655a0d76398acec5e439229c74120c696) Implement real fill and opacity styles. `RectangleElement` and `EllipseElement` now carry an optional `fillColor`, and every element carries an optional `opacity`; the renderer applies the fill to the shape and the opacity to the element's SVG group. `ToolOptions` gains `opacity` (default `1`), while `fillColor` now affects the rectangle and ellipse tools and restyles selected shapes, which makes translucent highlighter annotations possible. `CanvasElementStyle` is now the shared base of `ToolOptions` instead of an unused standalone type. Freehand paths remain unfilled.

- [`67eda0a`](https://github.com/adrawdev/adraw/commit/67eda0ab6ac1b02d00b437a09cf33d824f5e5420) Add engine-level history controls: `clearHistory()` resets undo/redo with the current state as the new baseline, `withoutHistory(fn)` suppresses checkpoints while running a callback, and `pushHistory()` is now public. `insertMedia()` accepts `{ history: false }`, and changes made outside history are folded into existing checkpoints so undo/redo preserves them. Loaded or programmatic documents no longer disappear or get reintroduced on `Ctrl+Z`.

- [`febc193`](https://github.com/adrawdev/adraw/commit/febc1936704cb7dcdafb0686f83d21caaf1ea81a) Add `initialElements` / `initialDocument` to core constructor options. Initial content is cloned, resolves arrow bindings, and becomes the history baseline so the first undo does not remove it.

  Vue, Solid and Svelte providers now create the engine headlessly and only mount it in `<Canvas>`; Angular and Web Components already did. They all gain `onReady(engine)` (or `adraw:ready` / `isReady` for Web Components) and a reactive readiness flag, and Vue/Solid/Svelte/Angular expose `useCanvasEngine()` returning `{ engine, isReady }`.

- [`44a26de`](https://github.com/adrawdev/adraw/commit/44a26deb697224e1e898174a3be1d244135f24bf) Scope keyboard shortcuts to the focused canvas by default with a new `keyboard: "canvas" | "document" | "none"` option. The default is now `"canvas"` (previously shortcuts were handled document-wide); pass `keyboard: "document"` to restore the old behavior. The SVG is now focusable (`tabIndex`) and takes focus on pointer down, so shortcuts no longer fire while a form control or dialog has focus. `destroy()` now removes the keyboard listener and unsubscribes the adapter's engine event handlers, so unmounts and React StrictMode double-mounts no longer leave shortcuts alive or stack listeners. Adapters forward the new option.

- [`15b3f66`](https://github.com/adrawdev/adraw/commit/15b3f668f79a1d28fc67f1234f3603e97190e57f) Bring the text tool closer to Excalidraw. `TextElement` gains optional `fontFamily`, `textAlign`, `lineHeight` and `autoSize` fields (auto-sized by default; fixed-width text wraps at its width). Text is now measured with an injectable `TextMeasurer`: headless engines keep the deterministic character approximation, `AdrawCanvas.mount` installs a canvas-backed measurer, and `measureText` / `setTextMeasurer()` let hosts supply their own. The inline editor matches the rendered font, line height, alignment, rotation and box, and editing now follows Excalidraw semantics (`Enter` inserts a newline, `Escape` and `Ctrl`/`Cmd+Enter` commit, `Enter`/`F2` or double-click edits a selected text, and the text tool edits text under the pointer instead of stacking a new element). Dragging a side resize handle switches text to fixed-width wrapping; corners and vertical edges scale the font size. The default line height is now `1.25` (previously `1.2`), so `measureTextSize()` and existing text element heights change slightly. The text tool options and every adapter's `useStyle("text")` expose the new fields.

  Text elements can also be labels: `containerId` binds a label to a rectangle, ellipse or arrow, and `labelPosition` places arrow labels along the line. Double-clicking a shape or arrow (or clicking near a shape's center with the text tool) creates a centered label. Shape labels wrap at the shape's inner width but size their box to the longest wrapped line, so their inline editor grows and shrinks both horizontally and vertically; `wrapWidth` stores the wrap limit. Labels rotate and move with their container, grow it vertically when needed, and are deleted with it. Labels are copied and pasted with their container and follow its z-order. Dragging horizontally with the text tool creates a fixed-width free text; dragging away from a shape's center creates free text instead of a label. Text style changes applied to a selected labeled shape are forwarded to its label. Arrow labels split the arrow shaft around their box, so the line no longer crosses the text. Double-clicking empty canvas now creates an auto-sized free text through the same editing path as the text tool. Starting any text edit switches the active tool to `select` and clears the selection so no resize handles are shown while typing; the text or its container is selected again when the edit ends.

- [`63f33ab`](https://github.com/adrawdev/adraw/commit/63f33ab35c54b6bc74e133b63dbeef69a92bd5e8) `toImage` gains an explicit `background` color (`background: "#fff"`, or `true` for `--adraw-background`) and an `exclude` element filter. Excluded elements are left out of both the drawing and the exported bounds. Export bounds are now computed from the exported content only: they follow z-order/visibility, include locked elements, account for rotation, and pad for stroke and arrowhead overhang so rotated shapes and horizontal lines/arrows are no longer clipped. `getElementBounds` now returns the correct axis-aligned bounds for rotated rectangles.

- [`4b67661`](https://github.com/adrawdev/adraw/commit/4b67661e74e8a402329640eeee5661f45c4d6a32) Add per-tool style configuration. `CanvasOptions.tools` accepts defaults for `draw` (`strokeWidth`, `smoothing`, stroke color), `rectangle` (`cornerRadius`, `strokeWidth`), `text` (`fontSize`), and the ellipse/line/arrow strokes. `engine.getToolOptions(tool)` returns resolved defaults, `engine.setToolOptions(tool, partial)` updates future elements and restyles matching selected elements, and a new `toolOptionsChange` event reports resolved values. Rendering now updates stroke width and rectangle corner radius in place.

  All adapters mirror the new state and event: React/Solid/Vue/Svelte/Angular add `useToolOptions()` and `useStyle(tool?)`; Web Components adds the `toolOptions` field, `getToolOptions()`/`setToolOptions()` methods and `adraw:tooloptionschange`. The React, Solid, Svelte and Web Components adapters now also forward all `CanvasOptions` (including `tools` and `clipboard`) to the core instance.

- [`f8c9bae`](https://github.com/adrawdev/adraw/commit/f8c9bae6cf906ea8d3da1a2ce0a2a0573359b612) Add viewport configuration and bounds-aware fitting. `CanvasOptions.viewport` accepts `minZoom`, `maxZoom`, `zoomSensitivity`, `fitPadding` and `constrainToContent`; the engine now honors them for wheel zoom, `zoomIn`/`zoomOut`, `resetZoom`, `setViewport` and `zoomToFit` (previously those paths always used 0.1–10). The engine also exposes `getViewportConfig()`.

  `zoomToFit({ padding?, bounds? })` now accepts an explicit padding and bounds, using `viewport.fitPadding` (32px) by default. Bounds can be either `{ x, y, width, height }` or `{ left, right, top, bottom }`; omitting them fits all visible elements. When bounds are supplied they also define the region used by `constrainToContent` until the next fit. With `constrainToContent: true`, panning is clamped so content stays in view and zooming out cannot go below the zoom of the last fit, so calling `zoomToFit()` after loading content keeps users from drifting away from it.

  All adapters forward the new options and `zoomToFit(options)` arguments (React/Solid/Vue/Svelte `useViewport()`, the Angular `CanvasService`/`useViewport()`, and Web Components through `CanvasOptions`).

- [`5c8f40d`](https://github.com/adrawdev/adraw/commit/5c8f40d3aadac344b8344e21f2ba9833832d77ac) Add z-order controls: `bringToFront(ids)`, `sendToBack(ids)`, `setZIndex(id, zIndex)` and a `zIndex` option for `insertMedia`. SVG nodes now render in ascending `zIndex` order, so programmatic restacking is reflected on screen.

### Patch Changes

- [`3f4f11f`](https://github.com/adrawdev/adraw/commit/3f4f11f3956dce29c9fddebc5202c88c70bad41e) Prevent native HTML5 drag-and-drop inside the canvas. Firefox could start dragging a shape when the select tool moved it, which cancelled the pointer gesture (`pointercancel`) and left the shape in place instead of following the pointer.

- [`db2005c`](https://github.com/adrawdev/adraw/commit/db2005ccb435ed1bc3975e4fe36678a8c8207b79) Fix text selection handling in WebKit: SVG `<text>` elements now set the prefixed `-webkit-user-select: none` in addition to `user-select`, because WebKit ignores (and does not serialize) the unprefixed property on SVG text. This prevents accidental text selection while dragging or editing on the canvas.

## 0.4.0

### Minor Changes

- [`cc2366e`](https://github.com/adrawdev/adraw/commit/cc2366e26731e1aebd2adc6a5b12f4f230e7d142) Add an `arrow` tool and element type. Drag to draw a straight arrow with a filled head; drop either endpoint on a rectangle, ellipse, text, media or group to bind it. Bound endpoints aim at the target's center, are clipped just outside its border (with a `max(4, strokeWidth)` gap), and follow the target through moves, resizes and rotations. Moving/resizing an arrow directly detaches its bindings unless its targets move along in the same gesture; dragging an endpoint handle rebinds or unbinds it. Deleting a target detaches the arrow and freezes its last coordinates; hiding a target keeps the binding. Bindings survive copy/paste when the target is part of the copied batch (and are dropped otherwise). Public API adds the `arrow` `ToolType`, `ArrowElement`/`ArrowBinding` types and the `createArrow` factory; both arrowheads can be enabled via `startArrowhead`/`endArrowhead`.

- [`311d282`](https://github.com/adrawdev/adraw/commit/311d2826d46fc125acbaeb5e49e27ee9c221ac09) Add clipboard support: `copy()`, `cut()`, and `paste()` on `AdrawCanvas`, plus `Ctrl/Cmd + C/X/V` shortcuts. Paste inserts fresh-ID clones centered on the current pointer (grouped children included, group references remapped) as a single undo step. `serializeClipboard()` / `deserializeClipboard()` bridge the in-memory buffer to the system clipboard, with custom `clipboard: { serialize, deserialize }` hooks.

- [`4200c29`](https://github.com/adrawdev/adraw/commit/4200c29efb29e0079a03ec52b848a7c14c0b1f8f) Constrain rectangle and ellipse creation with `Shift` for square proportions and `Alt` to size from the center point.

- [`b16b4dd`](https://github.com/adrawdev/adraw/commit/b16b4dd45f0666d35b5016835852a13c2ca5553e) Snap elements to other elements' edges and centers while moving, resizing or drawing. Snapping activates while holding Ctrl/Cmd, or by default with the new `isSnapMode` option; alignment guides are rendered while snapped.

  **Breaking:** `snapping.enabled` was removed. Snapping is always available and gated per gesture by Ctrl/Cmd or `isSnapMode`; `SnappingConfig` is now `{ threshold }`.

### Patch Changes

- [`8fdfb7b`](https://github.com/adrawdev/adraw/commit/8fdfb7b2e855d7790e7319ce4f3003aba6e139aa) Render element changes incrementally during `change` events: committed element DOM nodes are now cached by id and only rewritten when the element's geometry actually changed, instead of re-writing every node in the elements group. Dragging one element out of a board with many elements now updates just that element's node per frame, significantly reducing per-move rendering cost on element-heavy boards.

## 0.3.0

### Minor Changes

- Resize elements from the center while holding the Alt key.

- [`6d5962e`](https://github.com/adrawdev/adraw/commit/6d5962e5577fe1138a557136e76666f5c78cfcfa) Constrain element proportions while resizing with the Shift key.

- [`ab7567d`](https://github.com/adrawdev/adraw/commit/ab7567d058310627b9fb046ea6804af731ef37c2) Add pointer capture on drag start so drawing, moving, resizing, and rotating keep working when the pointer leaves the container or the browser window. A cancelled pointer (e.g. an OS gesture taking over) now finalizes the in-progress tool action instead of leaving it stuck.

- Add `toImage()` to export the canvas as an image blob (PNG or SVG), with options for background, pixel ratio, dark mode, and dynamic styling.

- Split the canvas into a headless `CanvasEngine` and a DOM adapter. `AdrawCanvas` now extends `CanvasEngine` and can be constructed headless with deferred `mount(container)` and `destroy()` lifecycle methods.

- Add `insertMedia()` for inserting image and media elements, with automatic viewport fitting, z-index layer management, and auto-selection of inserted elements.

- Show per-element bounding boxes for multi-selections in the transform overlay, in addition to the group bounds.

- Add global stroke color management via `setStrokeColor()`, customizable stroke properties for rectangles and ellipses, and round stroke caps and joins for line and path elements.

- Add a text tool and `TextElement` type with inline editing. Click with the text tool to create editable multi-line text rendered as SVG, with an inline textarea overlay for editing.

### Patch Changes

- Fix text editor and selection behavior: keep the text editor and toolbar visible during editing, prevent native text selection from interfering with canvas gestures, and match the text editor stroke color to the active stroke.

- [`4b50663`](https://github.com/adrawdev/adraw/commit/4b50663cbfd1f8e71f6e5ff960eb248ea41e426a) Allow dragging multiple selected elements from empty space inside their selection bounds.

## 0.2.0

### Minor Changes

- **Line tool**: new `line` element type with `startX`/`startY`/`endX`/`endY`, dedicated line tool in the tool system, hit testing, selection stroke, and rotation support.

- **Auto-switch to select**: after creating an element with any creation tool (rectangle, ellipse, line, draw), the canvas automatically switches to the select tool. The newly created element is also automatically selected. Automatic selection can be prevented when needed.

- **Light-dark color mode**: color constants now support `light-dark()` CSS color function, enabling automatic theme adaptation via CSS `color-scheme`.

- **Transform overlay improvements**:

  - Overlay now renders immediately on tool change and clears selection on deactivation.
  - `isTransforming` split into `isResizing` and `isRotating` for more granular overlay suppression.
  - Improved rotation handling for multi-selection groups.
  - `selectElements` renamed to `renderSelectElements`.
  - Redundant line stroke update logic removed.

## 0.1.1

### Patch Changes

- **Rendering architecture (major refactor)**

  - **Incremental DOM**: replaced full `innerHTML = ""` wipe with `reconcileElements()` that diffs the DOM: drops stale nodes, updates existing in place, appends new ones. Unchanged elements keep their DOM nodes intact.

  - **Temporary group removed**: in-progress tool elements render directly into `elementsGroup` as the last child, tracked by a reusable `temporaryNode`/`temporaryType`, avoiding node recreation per pointer move.

  - **Persistent transform overlay**: `ensureOverlayNodes()` builds bounding box, 4 edge bands, rotation handle, and 4 resize handles once; `renderTransformOverlay()` updates them in place (\~10 fewer SVG nodes created per pointer move).

  - **`updateElementGeometry()`**: shared in-place update helper for all element types, used by both `reconcileElements()` and `selectElements()`.

- **Select tool**

  - **Marquee/brush selection**: pointer-down on empty space starts a rubber-band box; all intersected elements get selected. Shift-key unions onto existing selection. No history push for selection-only actions.

  - **Multi-element rotation**: orbiting each element's center around the selection center (not just changing rotation). Path elements get points translated. Single elements still rotate in place.

  - **`isTransforming()` / `getSelectionBox()`**: new Tool interface methods; first signals active resize/rotation, second exposes the marquee rect.

  - **Invisible edge bands**: 4 translucent lines on edges act as axis-aligned resize handles via `pointer-events: stroke`.

- **History**

  - **Baseline checkpoint**: the undo stack top now always mirrors current state; `canUndo()` returns false only when only the baseline remains. Fixes undo restoring from the wrong entry and redo pushing stale state onto the undo stack.

- **Styling \& constants**

  - **src/constants.ts**: new file centralizing CSS-var fallback strings (`STROKE_COLOR`, `FILL_COLOR`, `BACKGROUND_COLOR`, `SELECTION_COLOR`) and numeric `STROKE_WIDTH = 2`.

  - **CSS var rename**:

    - `--adraw-stroke-color` → `--adraw-stroke`
    - `--adraw-fill-color` → `--adraw-fill`
    - `--adraw-selection-color` → `--adraw-selection`

  - **Non-scaling stroke**: bounding box and handles use `vector-effect="non-scaling-stroke"` and sizes divided by `viewport.zoom` for screen-pixel consistency.

- **Options \& API**

  - **`hideOverlayWhileTransforming`**: new `CanvasOptions` flag (default true) to hide transform overlay during resize/rotation gestures so it doesn't visually lag. Exposed via `getHideOverlayWhileTransforming()` / `setHideOverlayWhileTransforming()`.

- **Path element**

  - **`fillColor` removed from `PathElement` type and `createPathElement`**: paths render `fill="none"` unconditionally.
