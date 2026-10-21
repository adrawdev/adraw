# @adraw/web-components

## 0.2.0

### Minor Changes

- [`3fb901e`](https://github.com/adrawdev/adraw/commit/3fb901e655a0d76398acec5e439229c74120c696) Implement real fill and opacity styles. `RectangleElement` and `EllipseElement` now carry an optional `fillColor`, and every element carries an optional `opacity`; the renderer applies the fill to the shape and the opacity to the element's SVG group. `ToolOptions` gains `opacity` (default `1`), while `fillColor` now affects the rectangle and ellipse tools and restyles selected shapes, which makes translucent highlighter annotations possible. `CanvasElementStyle` is now the shared base of `ToolOptions` instead of an unused standalone type. Freehand paths remain unfilled.

- [`febc193`](https://github.com/adrawdev/adraw/commit/febc1936704cb7dcdafb0686f83d21caaf1ea81a) Add `initialElements` / `initialDocument` to core constructor options. Initial content is cloned, resolves arrow bindings, and becomes the history baseline so the first undo does not remove it.

  Vue, Solid and Svelte providers now create the engine headlessly and only mount it in `<Canvas>`; Angular and Web Components already did. They all gain `onReady(engine)` (or `adraw:ready` / `isReady` for Web Components) and a reactive readiness flag, and Vue/Solid/Svelte/Angular expose `useCanvasEngine()` returning `{ engine, isReady }`.

- [`15b3f66`](https://github.com/adrawdev/adraw/commit/15b3f668f79a1d28fc67f1234f3603e97190e57f) Bring the text tool closer to Excalidraw. `TextElement` gains optional `fontFamily`, `textAlign`, `lineHeight` and `autoSize` fields (auto-sized by default; fixed-width text wraps at its width). Text is now measured with an injectable `TextMeasurer`: headless engines keep the deterministic character approximation, `AdrawCanvas.mount` installs a canvas-backed measurer, and `measureText` / `setTextMeasurer()` let hosts supply their own. The inline editor matches the rendered font, line height, alignment, rotation and box, and editing now follows Excalidraw semantics (`Enter` inserts a newline, `Escape` and `Ctrl`/`Cmd+Enter` commit, `Enter`/`F2` or double-click edits a selected text, and the text tool edits text under the pointer instead of stacking a new element). Dragging a side resize handle switches text to fixed-width wrapping; corners and vertical edges scale the font size. The default line height is now `1.25` (previously `1.2`), so `measureTextSize()` and existing text element heights change slightly. The text tool options and every adapter's `useStyle("text")` expose the new fields.

  Text elements can also be labels: `containerId` binds a label to a rectangle, ellipse or arrow, and `labelPosition` places arrow labels along the line. Double-clicking a shape or arrow (or clicking near a shape's center with the text tool) creates a centered label. Shape labels wrap at the shape's inner width but size their box to the longest wrapped line, so their inline editor grows and shrinks both horizontally and vertically; `wrapWidth` stores the wrap limit. Labels rotate and move with their container, grow it vertically when needed, and are deleted with it. Labels are copied and pasted with their container and follow its z-order. Dragging horizontally with the text tool creates a fixed-width free text; dragging away from a shape's center creates free text instead of a label. Text style changes applied to a selected labeled shape are forwarded to its label. Arrow labels split the arrow shaft around their box, so the line no longer crosses the text. Double-clicking empty canvas now creates an auto-sized free text through the same editing path as the text tool. Starting any text edit switches the active tool to `select` and clears the selection so no resize handles are shown while typing; the text or its container is selected again when the edit ends.

- [`4b67661`](https://github.com/adrawdev/adraw/commit/4b67661e74e8a402329640eeee5661f45c4d6a32) Add per-tool style configuration. `CanvasOptions.tools` accepts defaults for `draw` (`strokeWidth`, `smoothing`, stroke color), `rectangle` (`cornerRadius`, `strokeWidth`), `text` (`fontSize`), and the ellipse/line/arrow strokes. `engine.getToolOptions(tool)` returns resolved defaults, `engine.setToolOptions(tool, partial)` updates future elements and restyles matching selected elements, and a new `toolOptionsChange` event reports resolved values. Rendering now updates stroke width and rectangle corner radius in place.

  All adapters mirror the new state and event: React/Solid/Vue/Svelte/Angular add `useToolOptions()` and `useStyle(tool?)`; Web Components adds the `toolOptions` field, `getToolOptions()`/`setToolOptions()` methods and `adraw:tooloptionschange`. The React, Solid, Svelte and Web Components adapters now also forward all `CanvasOptions` (including `tools` and `clipboard`) to the core instance.

- [`f8c9bae`](https://github.com/adrawdev/adraw/commit/f8c9bae6cf906ea8d3da1a2ce0a2a0573359b612) Add viewport configuration and bounds-aware fitting. `CanvasOptions.viewport` accepts `minZoom`, `maxZoom`, `zoomSensitivity`, `fitPadding` and `constrainToContent`; the engine now honors them for wheel zoom, `zoomIn`/`zoomOut`, `resetZoom`, `setViewport` and `zoomToFit` (previously those paths always used 0.1–10). The engine also exposes `getViewportConfig()`.

  `zoomToFit({ padding?, bounds? })` now accepts an explicit padding and bounds, using `viewport.fitPadding` (32px) by default. Bounds can be either `{ x, y, width, height }` or `{ left, right, top, bottom }`; omitting them fits all visible elements. When bounds are supplied they also define the region used by `constrainToContent` until the next fit. With `constrainToContent: true`, panning is clamped so content stays in view and zooming out cannot go below the zoom of the last fit, so calling `zoomToFit()` after loading content keeps users from drifting away from it.

  All adapters forward the new options and `zoomToFit(options)` arguments (React/Solid/Vue/Svelte `useViewport()`, the Angular `CanvasService`/`useViewport()`, and Web Components through `CanvasOptions`).

### Patch Changes

- [`44a26de`](https://github.com/adrawdev/adraw/commit/44a26deb697224e1e898174a3be1d244135f24bf) Scope keyboard shortcuts to the focused canvas by default with a new `keyboard: "canvas" | "document" | "none"` option. The default is now `"canvas"` (previously shortcuts were handled document-wide); pass `keyboard: "document"` to restore the old behavior. The SVG is now focusable (`tabIndex`) and takes focus on pointer down, so shortcuts no longer fire while a form control or dialog has focus. `destroy()` now removes the keyboard listener and unsubscribes the adapter's engine event handlers, so unmounts and React StrictMode double-mounts no longer leave shortcuts alive or stack listeners. Adapters forward the new option.
- Updated dependencies [[`095d354`](https://github.com/adrawdev/adraw/commit/095d354e84372e41fb9cc7d00954c320d215fc8e), [`3fb901e`](https://github.com/adrawdev/adraw/commit/3fb901e655a0d76398acec5e439229c74120c696), [`67eda0a`](https://github.com/adrawdev/adraw/commit/67eda0ab6ac1b02d00b437a09cf33d824f5e5420), [`febc193`](https://github.com/adrawdev/adraw/commit/febc1936704cb7dcdafb0686f83d21caaf1ea81a), [`44a26de`](https://github.com/adrawdev/adraw/commit/44a26deb697224e1e898174a3be1d244135f24bf), [`3f4f11f`](https://github.com/adrawdev/adraw/commit/3f4f11f3956dce29c9fddebc5202c88c70bad41e), [`15b3f66`](https://github.com/adrawdev/adraw/commit/15b3f668f79a1d28fc67f1234f3603e97190e57f), [`db2005c`](https://github.com/adrawdev/adraw/commit/db2005ccb435ed1bc3975e4fe36678a8c8207b79), [`63f33ab`](https://github.com/adrawdev/adraw/commit/63f33ab35c54b6bc74e133b63dbeef69a92bd5e8), [`4b67661`](https://github.com/adrawdev/adraw/commit/4b67661e74e8a402329640eeee5661f45c4d6a32), [`f8c9bae`](https://github.com/adrawdev/adraw/commit/f8c9bae6cf906ea8d3da1a2ce0a2a0573359b612), [`5c8f40d`](https://github.com/adrawdev/adraw/commit/5c8f40d3aadac344b8344e21f2ba9833832d77ac)]:
  - @adraw/core@0.5.0

## 0.1.4

### Patch Changes

- [`b16b4dd`](https://github.com/adrawdev/adraw/commit/b16b4dd45f0666d35b5016835852a13c2ca5553e) Snap elements to other elements' edges and centers while moving, resizing or drawing. Snapping activates while holding Ctrl/Cmd, or by default with the new `isSnapMode` option; alignment guides are rendered while snapped.

  **Breaking:** `snapping.enabled` was removed. Snapping is always available and gated per gesture by Ctrl/Cmd or `isSnapMode`; `SnappingConfig` is now `{ threshold }`.

- Updated dependencies [[`cc2366e`](https://github.com/adrawdev/adraw/commit/cc2366e26731e1aebd2adc6a5b12f4f230e7d142), [`311d282`](https://github.com/adrawdev/adraw/commit/311d2826d46fc125acbaeb5e49e27ee9c221ac09), [`8fdfb7b`](https://github.com/adrawdev/adraw/commit/8fdfb7b2e855d7790e7319ce4f3003aba6e139aa), [`4200c29`](https://github.com/adrawdev/adraw/commit/4200c29efb29e0079a03ec52b848a7c14c0b1f8f), [`b16b4dd`](https://github.com/adrawdev/adraw/commit/b16b4dd45f0666d35b5016835852a13c2ca5553e)]:
  - @adraw/core@0.4.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`6d5962e`](https://github.com/adrawdev/adraw/commit/6d5962e5577fe1138a557136e76666f5c78cfcfa), [`ab7567d`](https://github.com/adrawdev/adraw/commit/ab7567d058310627b9fb046ea6804af731ef37c2), [`4b50663`](https://github.com/adrawdev/adraw/commit/4b50663cbfd1f8e71f6e5ff960eb248ea41e426a)]:
  - @adraw/core@0.3.0

## 0.1.2

### Patch Changes

- Updated dependencies

  - @adraw/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies

  - @adraw/core@0.1.1
