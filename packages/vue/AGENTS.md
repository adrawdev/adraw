# AGENTS.md — @adraw/vue

## Purpose

Vue 3 bindings for adraw. Provides composables and components via `provide`/`inject` with support for multiple independent canvas instances.

## Exports

All defined in `src/index.ts` (single file):

- `CanvasProvider` — component; pass `options?: CanvasVueOptions`
- `Canvas` — component; renders mount `<div>`, calls `core.mount()` on `onMounted`, `destroy()` on `onUnmounted`; must be inside `CanvasProvider`
- `createCanvas(options?)` — factory: returns `{ core: AdrawCanvas, state: reactive<CanvasState>, vanilla: ref<AdrawCanvas | null> }`
- `useCanvas()` — injects nearest `CanvasProvider` context
- `useTool()` — returns `{ tool, setTool }` (computed getter + method)
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useToolOptions()` — returns `{ toolOptions, setToolOptions }` (reactive getter + generic setter)
- `useStyle(tool?)` — returns `{ tool, style, setStyle }` reactive getters; infers from selection/active tool when omitted
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasVueOptions` — interface extending `CanvasOptions` (adds `initialViewport`)
- `CanvasState` — reactive state interface (includes `toolOptions`)
- `CanvasContext` — return type of `createCanvas`

## Usage

```vue
<template>
  <CanvasProvider>
    <Toolbar />
    <Canvas class="w-full h-full" />
  </CanvasProvider>
</template>

<script setup>
import { useTool, useViewport } from "@adraw/vue"

function Toolbar() {
  const { tool, setTool } = useTool()
  const { zoomIn, zoomOut } = useViewport()
  return { tool, setTool, zoomIn, zoomOut }
}
</script>
```

## How it works

1. `CanvasProvider` calls `createCanvas(options)` in `setup()`, `provide()`s the context key
2. `Canvas` component calls `useCanvas()` to get the context, mounts the canvas in `onMounted`
3. Core events (including `toolOptionsChange`) are subscribed in `createCanvas`, copying payloads into a reactive `state` object
4. `useCanvas()` must be called synchronously during `setup()` (Vue `inject()` requirement)
5. Multiple `<CanvasProvider>` instances can coexist (each provides its own context symbol)

## Build

```bash
pnpm build:vue    # tsdown --minify
pnpm dev:vue      # watch mode
```

## Code style

- `tsconfig.json` extends `@vue/tsconfig/tsconfig.dom.json` (not root tsconfig)
- No semicolons, double quotes, 2-space indent
- Reactive state via `reactive()`, canvas instance via `ref()`
- Copy event payloads into state: `new Map(newElements)`, `new Set(newSelectedIds)`
- Vue-specific: `h()` for render functions, `InjectionKey` for provide/inject
