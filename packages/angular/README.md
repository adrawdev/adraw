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
provideCanvas({ snapping: { threshold: 8 } })
```

| Argument  | Type                   | Description                        |
| --------- | ---------------------- | ---------------------------------- |
| `options` | `CanvasAngularOptions` | Initial snapping / viewport config |

### `Canvas` (`<adraw-canvas>`)

Standalone component that mounts the drawing surface into its own host element (which fills its parent). Must be rendered under a component that provides the canvas.

```html
<adraw-canvas class="my-canvas" style="flex: 1" />
```

### `CanvasService`

The injectable that wraps the underlying `AdrawCanvas`. `provideCanvas()` registers it; inject it directly with `inject(CanvasService)` (or via `useCanvas()`) for full access. It exposes the read-only signals `elements`, `viewport`, `activeTool`, `selectedIds`, `canUndo`, `canRedo`, `hideWhileTransforming`, the imperative methods used by the hooks, and `instance` (the raw `AdrawCanvas`).

## Hooks

All hooks must be called in an injection context and resolve the nearest provided `CanvasService`.

### `useCanvas()`

Returns the `CanvasService` for the nearest `provideCanvas()`.

### `useTool()`

```ts
const { tool, setTool } = useTool()
// tool: Signal<ToolType> — "select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "line"
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
