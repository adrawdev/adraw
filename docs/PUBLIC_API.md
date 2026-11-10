# Public API inventory

This inventory tracks the surface covered by the
[API stability policy](API_STABILITY.md). Update it when a package entry point,
public method, element field, event or CSS custom property changes.

## Packages and entry points

| Package                 | Entry point                            |
| ----------------------- | -------------------------------------- |
| `@adraw/core`           | `packages/core/src/index.ts`           |
| `@adraw/react`          | `packages/react/src/index.ts`          |
| `@adraw/vue`            | `packages/vue/src/index.ts`            |
| `@adraw/svelte`         | `packages/svelte/src/index.ts`         |
| `@adraw/solid`          | `packages/solid/src/index.ts`          |
| `@adraw/angular`        | `packages/angular/src/public-api.ts`   |
| `@adraw/web-components` | `packages/web-components/src/index.ts` |

## @adraw/core

### Canvas and engine

`AdrawCanvas` extends `CanvasEngine`.

`AdrawCanvas` lifecycle and DOM entry points:

- `mount(container)`, `destroy()`, `render()`, `isMounted()`
- `handlePointerDown(x, y, event)`, `handlePointerMove(x, y, event)`,
  `handlePointerUp(x, y, event)`, `handleWheel(event, x?, y?)`
- `toImage(options?)`

`CanvasEngine` public methods by area:

| Area                 | Methods                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle            | `setCanvasSize(width, height)`, `setActiveTool(tool)`, `getActiveTool()`, `isMounted()`                                                                                                                                                                                                                                       |
| Viewport             | `getViewport()`, `setViewport(viewport)`, `getViewportConfig()`, `zoomIn()`, `zoomOut()`, `resetZoom()`, `zoomToFit(options?)`                                                                                                                                                                                                |
| Tools and keyboard   | `getTemporaryElement()`, `getKeyboardScope()`, `handleKeyDown(event)`                                                                                                                                                                                                                                                         |
| Elements             | `getElements()`, `addElement(elements, options?)`, `insertMedia(input, options?)`, `setElements(elements, options?)`                                                                                                                                                                                                          |
| Partial updates      | `updateElement(id, patch, options?)`, `updateElements(updates, options?)`                                                                                                                                                                                                                                                     |
| Flags                | `setLocked(ids, locked, options?)`, `setVisible(ids, visible, options?)`, `toggleLocked(ids, options?)`, `toggleVisible(ids, options?)`                                                                                                                                                                                       |
| Document             | `loadDocument(doc, options?)`, `toDocument(options?)`, `toJSON(options?)`                                                                                                                                                                                                                                                     |
| Z-order              | `bringToFront(ids, options?)`, `sendToBack(ids, options?)`, `setZIndex(id, zIndex, options?)`                                                                                                                                                                                                                                 |
| Selection and groups | `getSelectedIds()`, `selectAll()`, `clearSelection()`, `escapeSelection()`, `deleteSelected()`, `group()`, `ungroup()`                                                                                                                                                                                                        |
| Layout               | `nudge(ids, delta, options?)`, `align(ids, alignment, options?)`, `distribute(ids, axis, options?)`                                                                                                                                                                                                                           |
| Clipboard            | `copy()`, `cut()`, `paste(point?)`, `duplicate(ids?, options?)`, `serializeClipboard()`, `deserializeClipboard(data)`                                                                                                                                                                                                         |
| History              | `undo()`, `redo()`, `canUndo()`, `canRedo()`, `pushHistory()`, `clearHistory()`, `withoutHistory(fn)`, `batch(fn, options?)`                                                                                                                                                                                                  |
| Style and snapping   | `getStyle()`, `setStyle(options)`, `getSnappingConfig()`, `setSnappingConfig(config)`, `getGridConfig()`, `setGridConfig(config)`, `getIsSnapMode()`, `setIsSnapMode(value)`, `getSnapGuides()`, `getHideOverlayWhileTransforming()`, `setHideOverlayWhileTransforming(value)`, `getIsToolLocked()`, `setIsToolLocked(value)` |
| Text                 | `getTextMeasurer()`, `measureText(text, options)`, `setTextMeasurer(measurer)`, `refreshTextMetrics()`                                                                                                                                                                                                                        |

Methods marked `@internal` in JSDoc are adapter/tool plumbing and are **not**
part of the public API. This includes `commitScene`, `getGroupContext`,
`setGroupContext`, `getActiveToolInstance`, `getCanvasSize`, `getToolContext`,
`getPointerPoint`, `setSelectedIds`, `setPointerPoint`, `setSnapGuides`,
`setAdapterTextMeasurer`, `resetTextMeasurer`, `usesDefaultTextMeasurer`,
`nudgeSelection` and `hasSelection`.

### State

- `AdrawStore` — `new AdrawStore(canvas, options?)`, `getSnapshot()`,
  `subscribe(listener)`, `dispose()`.
- `AdrawSnapshot` fields: `elements`, `selectedIds`, `selectedElements`,
  `viewport`, `tool`, `canUndo`, `canRedo`, `style`, `snapping`, `grid`,
  `isSnapMode`, `isToolLocked`, `hideWhileTransforming`, `isReady`, `revision`.
- `AdrawStoreOptions` — `onReady(engine)`.

### Documents

- `DOCUMENT_VERSION` — current `CanvasDocument` schema version.
- `validateDocument(value)` — returns `{ valid, issues }`; never throws on
  malformed input.
- `migrateDocument(value)` — applies the built-in migration registry and
  validates the result.
- `serializeDocument(doc)` — deterministic JSON: elements sorted by `zIndex`
  then `id`, group children sorted by id, keys sorted recursively.
- `toDocument({ deterministic: true })` — sorted and canonicalized document;
  the default keeps map insertion order until 1.0.
- `DocumentIssue`, `DocumentIssueCode`, `DocumentValidationResult`.
- JSON Schema: `@adraw/core/schema.json` (package export `./schema.json`).
- `CanvasOptions.validateDocuments` — validate `initialDocument` and
  `loadDocument()` by default; defaults to `false`.

### Errors

- `AdrawError` — `code`, `message`, `hint?`, `details?`, `cause?`.
- `AdrawErrorCode`, `AdrawErrorOptions`, `ADRAW_ERROR_CODES`.

### Elements

`CanvasElement` is the union of `RectangleElement`, `EllipseElement`,
`DiamondElement`, `LineElement`, `ArrowElement`, `PathElement`,
`MediaElement`, `TextElement`, `NoteElement` and `GroupElement`.

`BaseElement` fields: `id`, `type`, `x`, `y`, `width`, `height`, `rotation`,
`zIndex`, `locked`, `visible`, `opacity?`.

Type-specific fields:

| Type        | Fields                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `rectangle` | `cornerRadius`, `strokeWidth`, `strokeColor`, `fillColor?`                                                                                 |
| `ellipse`   | `strokeWidth`, `strokeColor`, `fillColor?`                                                                                                 |
| `diamond`   | `strokeWidth`, `strokeColor`, `fillColor?`                                                                                                 |
| `line`      | `startX`, `startY`, `endX`, `endY`, `strokeWidth`, `strokeColor`                                                                           |
| `arrow`     | `startX`, `startY`, `endX`, `endY`, `strokeWidth`, `strokeColor`, `startArrowhead?`, `endArrowhead?`, `startBinding?`, `endBinding?`       |
| `path`      | `points`, `strokeWidth`, `strokeColor`, `smoothing?`                                                                                       |
| `media`     | `src`, `mimeType`, `naturalWidth`, `naturalHeight`                                                                                         |
| `text`      | `text`, `fontSize`, `strokeColor`, `fontFamily?`, `textAlign?`, `lineHeight?`, `autoSize?`, `containerId?`, `labelPosition?`, `wrapWidth?` |
| `note`      | `text`, `fontSize`, `strokeColor`, `fillColor`, `fontFamily?`, `textAlign?`, `lineHeight?`, `padding`, `cornerRadius`                      |
| `group`     | `children`                                                                                                                                 |

### Options and geometry

- `CanvasOptions`, `AdrawCanvasOptions`, `ToImageOptions`, `MediaInput`
- `CanvasOptions.grid` — grid visibility, spacing and snapping; defaults to
  `{ enabled: false, size: 20, snap: false }`.
- `ClipboardOptions`, `KeyboardScope`
- `Point`, `Size`, `BoundingBox`, `ElementId`, `ElementType`, `ToolType`
- `ViewportState`, `ViewportConfig`, `ViewportBounds`, `ZoomToFitOptions`
- `CanvasElementStyle`, `StyleOptions`, `DEFAULT_STYLE`
- `SnappingConfig`, `SnapModifiers`, `SnapPoint`, `SnapGuide`, `SnapResult`
- `GridConfig`, `DEFAULT_GRID_CONFIG`
- `CanvasDocument`, `CanvasConfig`, `Transform`, `ResizeAnchor`, `Alignment`,
  `DistributeAxis`
- `EditableTextElement`, `TextAlign`, `TextLayoutOptions`, `TextLayout`,
  `LineMeasurer`, `TextMeasurer`, `ArrowBinding`, `ElementFactory`
- `HistoryEntry`, `HistoryState`

### Helpers

Exported helper functions are public:

- Coordinates: `screenToCanvas`, `canvasToScreen`, `getElementBounds`,
  `pointInBounds`, `distanceBetweenPoints`, `clamp`, `generateId`.
- Elements: `createRectangle`, `createEllipse`, `createDiamond`, `createLine`,
  `createArrow`, `createPath`, `createMedia`, `createText`, `createNote`,
  `createGroup`, `cloneElement`, `moveElement`, `resizeElement`,
  `rotateElement`, `measureTextSize`, `getNextZIndex`, `getElementAtPoint`,
  `getElementsBounds`, `DEFAULT_PATH_SMOOTHING`.
- History: `createHistoryState`, `pushHistory`, `undo`, `redo`, `canUndo`,
  `canRedo`, `clearHistory`.
- Snapping: `createSnappingConfig`, `isSnapActive`, `getElementSnapPoints`,
  `getAllSnapPoints`, `calculateSnap`, `snapPointToGuides`,
  `snapBoundsToElements`, `snapPointToElements`.
- Grid: `createGridConfig`, `DEFAULT_GRID_CONFIG`.
- Text: `approximateLineWidth`, `measureTextLayout`, `approximateTextMeasurer`,
  `measureTextElement`, `getTextLines`, `getTextLineHeightPx`,
  `getTextLeading`, `getTextAnchor`, `getTextLineX`.
- Viewport: `DEFAULT_VIEWPORT_CONFIG`, `resolveViewportConfig`,
  `normalizeViewportBounds`, `createViewport`, `panViewport`, `zoomViewport`,
  `zoomToFit`, `constrainViewportToBounds`, `resetViewport`.
- Tools: `createSelectTool`, `createHandTool`, `createRectangleTool`,
  `createEllipseTool`, `createDiamondTool`, `createLineTool`, `createArrowTool`,
  `createDrawTool`, `createEraserTool`, `createTextTool`, `createNoteTool`, and
  the `Tool` / `ToolContext` contracts.
- Partial updates: `ElementPatch`, `ElementUpdate`, `ElementUpdateResult`.

### CSS custom properties

- `--adraw-background`
- `--adraw-stroke`
- `--adraw-fill`
- `--adraw-selection`
- `--adraw-note`
- `--adraw-grid`
- `--adraw-grid-opacity`

CSS class names and DOM structure are internal.

## Framework adapters

Each adapter exports a canvas component/provider and the shared hook set:

| Package                 | Components / services                                                                          | Hooks / composables                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@adraw/react`          | `Canvas`, `CanvasProvider`; `CanvasProps`, `CanvasProviderProps`, `CanvasReactOptions`         | `useCanvas`, `useCanvasEngine`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useStyle`, `useTransformOverlay`, `CanvasEngineState` |
| `@adraw/vue`            | `Canvas`, `CanvasProvider`, `createCanvas`; `CanvasVueOptions`, `CanvasState`, `CanvasContext` | `useCanvas`, `useCanvasEngine`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useStyle`, `useTransformOverlay`, `CanvasEngineState` |
| `@adraw/svelte`         | `Canvas`, `CanvasProvider`; `CanvasSvelteOptions`, `CanvasContextValue`                        | `useCanvas`, `useCanvasEngine`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useStyle`, `useTransformOverlay`, `CanvasEngineState` |
| `@adraw/solid`          | `Canvas`, `CanvasProvider`; `CanvasProps`, `CanvasProviderProps`, `CanvasSolidOptions`         | `useCanvas`, `useCanvasEngine`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useStyle`, `useTransformOverlay`, `CanvasEngineState` |
| `@adraw/angular`        | `Canvas`, `CanvasService`, `provideCanvas`, `CANVAS_OPTIONS`; `CanvasAngularOptions`           | `useCanvas`, `useCanvasEngine`, `useTool`, `useViewport`, `useHistory`, `useSelection`, `useStyle`, `useTransformOverlay`, `CanvasEngineState` |
| `@adraw/web-components` | `AdrawCanvasElement`, `defineAdrawCanvas`; `CanvasWebComponentsOptions`, `AdrawCanvasEventMap` | —                                                                                                                                              |

Web Component events: `adraw:ready`, `adraw:change`, `adraw:viewportchange`,
`adraw:toolchange`, `adraw:selectionchange`.

`AdrawCanvasElement` also mirrors snapshots as public fields: `elements`,
`selectedElements`, `viewport`, `activeTool`, `selectedIds`,
`hideWhileTransforming`, `style`, `snapping`, `grid`, `isSnapMode`,
`isToolLocked`, `canUndo`, `canRedo`, `isReady`, plus `options`, `onReady`,
`canvas` and `store`.

## Not public

- Anything marked `@internal`.
- `Scene`, `state-notifier`, `engine/internal.ts`, `engine/pointer.ts`,
  clipboard internals, DOM renderers and event wiring.
- Package build configuration, tests, examples, the docs site and the `e2e`
  suite.
- CSS class names, DOM structure, private fields and unexported modules.

If you need an internal API, open an issue: promoting it to public is a
deliberate API change and follows the stability policy.
