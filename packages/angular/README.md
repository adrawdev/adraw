# @adraw/angular

Angular bindings for adraw — a service, a component, and injectable hooks for building canvas-based drawing and whiteboard UIs.

## Installation

```bash
pnpm add @adraw/angular

# npm
npm install @adraw/angular
```

Angular 17 or later is required as a peer dependency (the bindings are standalone and signal-based). State is exposed through [signals](https://angular.dev/guide/signals), so the components work with `OnPush` change detection and in zoneless apps.

## Quick start

Call `provideCanvas()` in the `providers` of the component that hosts both the drawing surface and any controls, render the `Canvas` component (`<adraw-canvas>`) where you want the surface, and read state from the injectable hooks in that component (or any of its children).

```ts
import { Component } from "@angular/core"
import { Canvas, provideCanvas } from "@adraw/angular"
import { Toolbar } from "./toolbar.component"

@Component({
  selector: "app-board",
  imports: [Canvas, Toolbar],
  providers: [provideCanvas()],
  template: `
    <app-toolbar />
    <adraw-canvas style="flex: 1" />
  `,
})
export class Board {}
```

```ts
// toolbar.component.ts
import { Component } from "@angular/core"
import { useTool } from "@adraw/angular"

@Component({
  selector: "app-toolbar",
  template: `
    <button [class.active]="tool() === 'select'" (click)="setTool('select')">
      Select
    </button>
    <button [class.active]="tool() === 'draw'" (click)="setTool('draw')">
      Draw
    </button>
    <button
      [class.active]="tool() === 'rectangle'"
      (click)="setTool('rectangle')"
    >
      Rectangle
    </button>
  `,
})
export class Toolbar {
  private readonly toolApi = useTool()
  protected readonly tool = this.toolApi.tool
  protected readonly setTool = this.toolApi.setTool
}
```

Reactive values (`tool`, `viewport`, `elements`, `selectedIds`, `canUndo`, `canRedo`) are returned as Angular **signals** — read them by calling them, including inside templates (`tool()`).

The hooks must be called in an [injection context](https://angular.dev/guide/di/dependency-injection-context) — a constructor or a field initializer — so `inject()` can resolve the `CanvasService` registered by `provideCanvas()`.

### Multiple canvases

Every component that calls `provideCanvas()` gets its own isolated `CanvasService`, so hooks resolve to the nearest one and several boards can coexist on the same page independently.

```ts
@Component({
  selector: "app-root",
  imports: [Board],
  template: `
    <app-board />
    <app-board />
  `,
})
export class App {}
```

## API

### `provideCanvas(options?)`

Returns the providers that register a component-scoped `CanvasService`. Add it to the `providers` array of the component that hosts `<adraw-canvas>` and its controls.

```ts
provideCanvas({
  initialElements: savedElements,
  snapping: { threshold: 8 },
  tools: { draw: { strokeWidth: 4 }, rectangle: { cornerRadius: 8 } },
  onReady: (engine) => engine.setActiveTool("draw"),
})
```

| Argument  | Type                   | Description                                                    |
| --------- | ---------------------- | -------------------------------------------------------------- |
| `options` | `CanvasAngularOptions` | Snapping / viewport / per-tool styles, initial document, ready |

`CanvasAngularOptions` extends the core options with `initialElements` /
`initialDocument` (`initialDocument` wins) and `onReady(engine)`, called once
after `<adraw-canvas>` mounts the engine.

### `Canvas` (`<adraw-canvas>`)

Standalone component that mounts the drawing surface into its own host element (which fills its parent). Must be rendered under a component that provides the canvas.

```html
<adraw-canvas class="my-canvas" style="flex: 1" />
```

### `CanvasService`

The injectable that wraps the underlying `AdrawCanvas`. `provideCanvas()` registers it; inject it directly with `inject(CanvasService)` (or via `useCanvas()`) for full access. It creates the engine headlessly in its constructor, exposes the read-only signals `elements`, `viewport`, `activeTool`, `selectedIds`, `canUndo`, `canRedo`, `hideWhileTransforming`, `isReady`, `toolOptions`, the imperative methods used by the hooks (including `getToolOptions` / `setToolOptions`), and `instance` (the raw `AdrawCanvas`).

## Hooks

All hooks must be called in an injection context and resolve the nearest provided `CanvasService`.

### `useCanvas()`

Returns the `CanvasService` for the nearest `provideCanvas()`. `CanvasService.instance` is the raw `AdrawCanvas`, which carries core-only APIs too, such as the clipboard (`copy()`, `cut()`, `paste()`).

### `useCanvasEngine()`

Returns `{ engine, isReady }`, where `isReady` is a signal:

```ts
const { engine, isReady } = useCanvasEngine()
// engine: AdrawCanvas — available before <adraw-canvas> renders
// isReady(): boolean — true after the engine is mounted
```

### `useTool()`

```ts
const { tool, setTool } = useTool()
// tool: Signal<ToolType> — "select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "line" | "text" | "arrow"
setTool("draw")
```

### `useViewport()`

```ts
const { viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit } =
  useViewport()
// viewport: Signal<ViewportState> — { x: number, y: number, zoom: number }
```

### `useHistory()`

```ts
const { undo, redo, canUndo, canRedo } = useHistory()
// canUndo / canRedo: Signal<boolean>
```

### `useSelection()`

```ts
const { selectedIds, elements, selectAll, clearSelection, deleteSelected } =
  useSelection()
// selectedIds, elements: Signal
```

### `useToolOptions()`

```ts
const { toolOptions, setToolOptions } = useToolOptions()
// toolOptions: Signal<ToolOptionsState>
setToolOptions("rectangle", { cornerRadius: 12 })
```

### `useStyle(tool?)`

Returns signals for one tool. Omit `tool` to infer it from a homogeneous
selection (or the active tool):

```ts
const { tool, style, setStyle } = useStyle()
// or: const { style, setStyle } = useStyle("rectangle")
// tool() and style() may be null when nothing applies

setStyle({ strokeWidth: 4 })
```

All tools share `strokeColor`, `strokeWidth` and `opacity`; `fillColor` applies
to `rectangle` and `ellipse` (combine it with `opacity < 1` for translucent
highlights). Tool-specific fields: `cornerRadius` (rectangle), `fontSize`
(text), `smoothing` (draw). Changes also restyle matching selected elements.

### `useTransformOverlay()`

```ts
const { hideWhileTransforming, setHideWhileTransforming } =
  useTransformOverlay()
// hideWhileTransforming: Signal<boolean> — whether the selection bounding box +
// resize/rotation handles are hidden while a resize/rotation gesture is in
// progress (defaults to true; set via the hideOverlayWhileTransforming option)
setHideWhileTransforming(false)
```

## License

MIT
