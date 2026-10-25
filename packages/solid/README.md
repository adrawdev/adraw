# @adraw/solid

SolidJS bindings for adraw — primitives and components for building canvas-based drawing and whiteboard UIs.

## Installation

```bash
pnpm add @adraw/solid

# npm
npm install @adraw/solid
```

SolidJS 1.0 or later is required as a peer dependency.

## Quick start

Wrap your canvas UI in a `CanvasProvider` and render a `Canvas`. Each `CanvasProvider` owns its own `AdrawCanvas` instance, so you can mount as many independent canvases as you like — just nest more providers.

```tsx
import { Canvas, CanvasProvider, useTool } from "@adraw/solid"

function Toolbar() {
  const { tool, setTool } = useTool()
  return (
    <div>
      <button onClick={() => setTool("select")}>Select</button>
      <button onClick={() => setTool("draw")}>Draw</button>
    </div>
  )
}

export default function App() {
  return (
    <CanvasProvider>
      <div
        style={{ display: "flex", "flex-direction": "column", height: "100vh" }}
      >
        <Toolbar />
        <Canvas style={{ flex: "1" }} />
      </div>
    </CanvasProvider>
  )
}
```

To render multiple independent canvases, use multiple `CanvasProvider`/`Canvas` pairs — each one mounts its own `AdrawCanvas` and the hooks below always talk to the nearest enclosing provider:

```tsx
<div style={{ display: "flex" }}>
  <CanvasProvider>
    <Toolbar />
    <Canvas style={{ flex: "1" }} />
  </CanvasProvider>
  <CanvasProvider>
    <Toolbar />
    <Canvas style={{ flex: "1" }} />
  </CanvasProvider>
</div>
```

## API

### `CanvasProvider`

```tsx
<CanvasProvider
  options={{
    initialElements: savedElements,
    snapping: { threshold: 8 },
  }}
  onReady={(engine) => engine.setActiveTool("draw")}
>
  {/* ... */}
</CanvasProvider>
```

Creates and owns an `AdrawCanvas` instance, scoped to its children via SolidJS context. The engine is created **headless** during provider setup, so descendants can use it before `<Canvas>` mounts. `options` accepts `CanvasOptions` from `@adraw/core`, including `initialElements` / `initialDocument` (`initialDocument` wins). Options are read at that point; changing the prop later does not recreate the engine, preserving in-progress content. `onReady(engine)` fires once after `<Canvas>` mounts.

### `Canvas`

```tsx
<Canvas class="my-canvas" style={{ background: "white" }} />
```

Renders the container element and mounts the `AdrawCanvas` from the nearest `CanvasProvider` into it on mount, tearing it down on cleanup.

### `useCanvas()`

Returns the raw context value (`canvasRef`, reactive accessors, `isReady`, and the resolved `options`) for the nearest `CanvasProvider`. Throws if used outside one. `canvasRef.current` is the engine and is available immediately; it carries core-only APIs too, such as the clipboard (`copy()`, `cut()`, `paste()`).

### `useCanvasEngine()`

Returns `{ engine, isReady }`, where `isReady` is a reactive accessor:

```ts
const { engine, isReady } = useCanvasEngine()
// engine: AdrawCanvas
// isReady(): boolean — true after <Canvas> mounts
```

### `useTool()`

```ts
const { tool, setTool } = useTool()
// tool: ToolType — reactive getter
setTool("rectangle")
```

### `useViewport()`

```ts
const { viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit } =
  useViewport()
// viewport: ViewportState — reactive getter
```

### `useHistory()`

```ts
const { undo, redo, canUndo, canRedo } = useHistory()
```

### `useSelection()`

```ts
const { selectedIds, elements, selectAll, clearSelection, deleteSelected } =
  useSelection()
// selectedIds / elements: reactive getters
```

### Styles

Styles are global. Use the engine's `setStyle` / `getStyle` through
`useCanvas().canvasRef.current`:

```ts
const { canvasRef } = useCanvas()

canvasRef.current.setStyle({ strokeColor: "#f00", strokeWidth: 3 })
canvasRef.current.getStyle() // selection style, or the global style
```

`setStyle` restyles matching selected elements as well as future ones. All tools
share `strokeColor`, `strokeWidth` and `opacity`; `fillColor` applies to
`rectangle`, `ellipse`, `diamond` and `note`. Tool-specific fields: `cornerRadius`
(rectangle and note), `fontSize` / `fontFamily` / `textAlign` / `lineHeight` /
`autoSize` (text), and `smoothing` (draw). Fields an element does not support
are ignored.

### `useTransformOverlay()`

```ts
const { hideWhileTransforming, setHideWhileTransforming } =
  useTransformOverlay()
// hideWhileTransforming: boolean — reactive getter; whether the selection
// bounding box + resize/rotation handles are hidden while a resize/rotation
// gesture is in progress (defaults to true; set via the
// hideOverlayWhileTransforming option)
setHideWhileTransforming(false)
```

## License

MIT
