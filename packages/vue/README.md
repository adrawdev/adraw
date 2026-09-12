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
<CanvasProvider :options="{ snapping: { threshold: 8 } }">
  ...
</CanvasProvider>
```

| Prop      | Type               | Description                        |
| --------- | ------------------ | ---------------------------------- |
| `options` | `CanvasVueOptions` | Initial snapping / viewport config |

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

### `createCanvas(options?)`

Low-level factory used internally by `CanvasProvider`. Returns `{ core, state, vanilla }`.

- `core` — the `AdrawCanvas` instance
- `state` — a Vue `reactive` object with `elements`, `viewport`, `activeTool`, and `selectedIds`
- `vanilla` — a `ref` to the `AdrawCanvas` instance (set after `core.mount()`)

Call this directly only if you want to manage mounting/destruction yourself instead of using `CanvasProvider`/`Canvas`.

### `useCanvas()`

Returns the canvas context (`{ core, state, vanilla }`) provided by the nearest `CanvasProvider`. Throws if called outside one. `core` carries core-only APIs too, such as the clipboard (`copy()`, `cut()`, `paste()`).

### `useTool()`

```ts
const { tool, setTool } = useTool()
// tool: getter — "select" | "hand" | "draw" | "eraser" | "rectangle" | "ellipse" | "line" | "text" | "arrow"
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
