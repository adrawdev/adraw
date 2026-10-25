# @adraw/svelte

Svelte bindings for adraw — components and composables for building canvas-based drawing and whiteboard UIs.

## Installation

```bash
pnpm add @adraw/svelte

# npm
npm install @adraw/svelte
```

Svelte 5 or later is required as a peer dependency.

## Quick start

Wrap the part of your app that needs the canvas with `CanvasProvider`, then render `Canvas` wherever you want the drawing surface. Each `CanvasProvider` creates its own isolated canvas instance, so you can mount as many independent boards as you like on the same page.

```svelte
<script lang="ts">
  import { Canvas, CanvasProvider, useTool } from "@adraw/svelte"
  import Toolbar from "./Toolbar.svelte"
</script>

<CanvasProvider>
  <Toolbar />
  <Canvas style="flex: 1;" />
</CanvasProvider>
```

```svelte
<!-- Toolbar.svelte -->
<script lang="ts">
  import { useTool } from "@adraw/svelte"

  const tool = useTool()
</script>

<button onclick={() => tool.setTool("select")} aria-pressed={tool.tool === "select"}>
  Select
</button>
<button onclick={() => tool.setTool("draw")} aria-pressed={tool.tool === "draw"}>
  Draw
</button>
```

## Components

### `<CanvasProvider>`

Sets up an isolated canvas context (via Svelte's context API) for its children. All composables and `<Canvas>` must be rendered inside it.

```svelte
<CanvasProvider
  options={{
    initialElements: savedElements,
    snapping: { threshold: 8 },
  }}
  onReady={(engine) => engine.setActiveTool("draw")}
>
  {@render children()}
</CanvasProvider>
```

| Prop      | Type                            | Description                                      |
| --------- | ------------------------------- | ------------------------------------------------ |
| `options` | `CanvasSvelteOptions`           | Snapping / viewport options and initial document |
| `onReady` | `(engine: AdrawCanvas) => void` | Called once after `<Canvas>` mounts the engine   |

`options` accepts `initialElements` / `initialDocument` from `@adraw/core`
(`initialDocument` wins). The provider creates the engine headlessly, so
components can use it during setup before `<Canvas>` mounts. Options are read
when the provider is created; changing the prop later does not recreate the
engine, preserving in-progress content.

### `<Canvas>`

Mounts the drawing surface. Fills its parent container (`width: 100%; height: 100%`).

```svelte
<Canvas class="my-canvas" style="border-radius: 8px;" />
```

| Prop    | Type     | Description   |
| ------- | -------- | ------------- |
| `class` | `string` | CSS class     |
| `style` | `string` | Inline styles |

## Composables

All composables must be called inside `<CanvasProvider>` (in the top level of a component's `<script>`, same as any Svelte context consumer).

### `useCanvas()`

Returns the raw context value: `store`, `snapshot`, `state` (reactive snapshot fields), `isReady`, and `instance` — a `{ current: AdrawCanvas }` ref that is populated as soon as the provider is created. The instance carries core-only APIs too, such as the clipboard (`copy()`, `cut()`, `paste()`).

### `useCanvasEngine()`

Returns `{ engine, isReady }`, where `isReady` is a reactive getter:

```ts
const { engine, isReady } = useCanvasEngine()
// engine: AdrawCanvas
// isReady: boolean getter — true after <Canvas> mounts
```

### `useTool()`

```ts
const tool = useTool()
// tool.tool: ToolType — "select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "diamond" | "line" | "text" | "arrow"
tool.setTool("draw")
```

### `useViewport()`

```ts
const viewport = useViewport()
viewport.viewport // ViewportState — { x: number, y: number, zoom: number }
viewport.zoomIn()
viewport.zoomOut()
viewport.resetZoom()
viewport.zoomToFit()
```

### `useHistory()`

```ts
const history = useHistory()
history.undo()
history.redo()
history.canUndo()
history.canRedo()
```

`canUndo()` and `canRedo()` read the store snapshot, so they stay reactive.

### `useSelection()`

```ts
const selection = useSelection()
// selection.selectedIds, selection.elements (selected elements)
selection.selectAll()
selection.clearSelection()
selection.deleteSelected()
```

### `useStyle()`

```svelte
<script lang="ts">
  import { useStyle } from "@adraw/svelte"

  const { style, setStyle } = useStyle()

  setStyle({ strokeColor: "#f00", strokeWidth: 3 })
  // style: selection style, or the global style
</script>
```

`setStyle` restyles matching selected elements as well as future ones. All tools
share `strokeColor`, `strokeWidth` and `opacity`; `fillColor` applies to
`rectangle`, `ellipse`, `diamond` and `note`. Tool-specific fields: `cornerRadius`
(rectangle and note), `fontSize` / `fontFamily` / `textAlign` / `lineHeight` /
`autoSize` (text), and `smoothing` (draw). Fields an element does not support
are ignored.

### `useTransformOverlay()`

```ts
const overlay = useTransformOverlay()
// overlay.hideWhileTransforming: boolean — whether the selection bounding box +
// resize/rotation handles are hidden while a resize/rotation gesture is in
// progress (defaults to true; set via the hideOverlayWhileTransforming option)
overlay.setHideWhileTransforming(false)
```

## License

MIT
