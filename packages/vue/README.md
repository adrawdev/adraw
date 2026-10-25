# @adraw/vue

Vue bindings for adraw — composables and components for building canvas-based drawing and whiteboard UIs.

## Installation

```bash
pnpm add @adraw/vue

# npm
npm install @adraw/vue
```

Vue 3.0 or later is required as a peer dependency.

## Quick start

Wrap your app (or the part that needs the canvas) with `CanvasProvider`, then render the `Canvas` component wherever you want the drawing surface. Composables access the canvas state anywhere inside that provider.

```vue
<script setup lang="ts">
import { Canvas, CanvasProvider, useTool } from "@adraw/vue"
</script>

<template>
  <CanvasProvider>
    <Toolbar />
    <Canvas style="flex: 1" />
  </CanvasProvider>
</template>
```

```vue
<!-- Toolbar.vue -->
<script setup lang="ts">
import { useTool } from "@adraw/vue"

const { tool, setTool } = useTool()
</script>

<template>
  <div>
    <button :class="{ active: tool === 'select' }" @click="setTool('select')">
      Select
    </button>
    <button :class="{ active: tool === 'draw' }" @click="setTool('draw')">
      Draw
    </button>
    <button
      :class="{ active: tool === 'rectangle' }"
      @click="setTool('rectangle')"
    >
      Rectangle
    </button>
  </div>
</template>
```

### Multiple canvases

Each `CanvasProvider` creates its own isolated canvas instance, so nesting several `CanvasProvider`/`Canvas` pairs on the same page gives you independent canvases — composables called inside a given subtree always resolve to the nearest ancestor provider.

```vue
<template>
  <CanvasProvider>
    <Canvas />
  </CanvasProvider>
  <CanvasProvider>
    <Canvas />
  </CanvasProvider>
</template>
```

## Components

### `CanvasProvider`

Creates the underlying canvas instance and makes it available to `Canvas` and all composables rendered inside it.

```vue
<CanvasProvider
  :options="{
    snapping: { threshold: 8 },
  }"
>
  ...
</CanvasProvider>
```

| Prop      | Type                            | Description                                      |
| --------- | ------------------------------- | ------------------------------------------------ |
| `options` | `CanvasVueOptions`              | Snapping / viewport options and initial document |
| `onReady` | `(engine: AdrawCanvas) => void` | Called once after `<Canvas>` mounts the engine   |

`options` accepts `initialElements` and `initialDocument` from
`@adraw/core`; the latter takes precedence. Initial content is applied when the
provider creates the engine, before the first render. Options are captured at
that point; changing the prop later does not recreate the engine, so in-progress
content is preserved.

### `Canvas`

Mounts the drawing surface inside a `div` that fills its parent. Must be rendered inside a `CanvasProvider`.

```vue
<Canvas class="my-canvas" :style="{ borderRadius: '8px' }" />
```

| Prop    | Type                  | Description   |
| ------- | --------------------- | ------------- |
| `class` | `string`              | CSS class     |
| `style` | `Record<string, any>` | Inline styles |

## Composables

All composables must be called inside a `CanvasProvider` — they throw if no provider is found in the ancestor tree.

### `createCanvas(options?, onReady?)`

Low-level factory used internally by `CanvasProvider`. Returns `{ core, isReady, markUnmounted, notifyReady, state, vanilla }`.

- `core` — the `AdrawCanvas` instance, created **headless** immediately
- `state` — a Vue `reactive` object with `elements`, `viewport`, `activeTool`, and `selectedIds`
- `vanilla` — a `ref` to the mounted `AdrawCanvas` instance (set after `core.mount()`)
- `isReady` — a ref that flips after `notifyReady()` / `markUnmounted()`

Call this directly only if you want to manage mounting/destruction yourself instead of using `CanvasProvider`/`Canvas`.

### `useCanvas()`

Returns the canvas context (`{ core, isReady, state, vanilla, … }`) provided by the nearest `CanvasProvider`. Throws if called outside one. `core` is available before the canvas is mounted and carries core-only APIs too, such as the clipboard (`copy()`, `cut()`, `paste()`).

### `useCanvasEngine()`

Returns `{ engine, isReady }`, where `isReady` is a reactive getter. The engine
exists as soon as the provider is created, so composables and effects do not
need to wait for a template ref.

```ts
const { engine, isReady } = useCanvasEngine()
// engine: AdrawCanvas
// isReady: boolean getter — true after <Canvas> mounts
```

### `useTool()`

```ts
const { tool, setTool } = useTool()
// tool: getter — "select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "diamond" | "line" | "text" | "arrow"
setTool("draw")
```

### `useViewport()`

```ts
const { viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit } =
  useViewport()
// viewport: getter — { x: number, y: number, zoom: number }
```

### `useHistory()`

```ts
const { undo, redo, canUndo, canRedo } = useHistory()
```

### `useSelection()`

```ts
const { selectedIds, elements, selectAll, clearSelection, deleteSelected } =
  useSelection()
```

### Styles

Styles are global. Use the engine's `setStyle` / `getStyle` through
`useCanvas().core`:

```ts
const { core } = useCanvas()

core.setStyle({ strokeColor: "#f00", strokeWidth: 3 })
core.getStyle() // selection style, or the global style
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
// hideWhileTransforming: getter — whether the selection bounding box +
// resize/rotation handles are hidden while a resize/rotation gesture is in
// progress (defaults to true; set via the hideOverlayWhileTransforming option)
setHideWhileTransforming(false)
```

## License

MIT
