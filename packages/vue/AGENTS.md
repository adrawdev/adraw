# AGENTS.md — @adraw/vue

## Purpose

Vue 3 adapter for adraw. Provides composables and components via `provide`/`inject` with support for multiple independent canvas instances.

## Exports

All defined in `src/index.ts` (single file):

- `CanvasProvider` — component; pass `options?: CanvasVueOptions` and `onReady?: (engine) => void`
- `Canvas` — component; renders mount `<div>`, calls `core.mount()` on `onMounted`, `destroy()` on `onUnmounted`; must be inside `CanvasProvider`
- `createCanvas(options?, onReady?)` — factory: creates the headless engine and store, returns `{ core, dispose, isReady, snapshot, state, store, vanilla }`
- `useCanvas()` — injects nearest `CanvasProvider` context
- `useCanvasEngine()` — returns `{ engine, isReady }` with a reactive `isReady` getter
- `useTool()` — returns `{ tool, setTool }` (computed getter + method)
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }` (`elements` are the selected elements)
- `useStyle()` — returns `{ style, setStyle }`
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasVueOptions` — interface extending `CanvasOptions` (adds `initialViewport`)
- `CanvasState` — reactive adapter state interface projected from an `AdrawSnapshot`
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

1. `CanvasProvider` calls `createCanvas(options, onReady)` in `setup()`; the factory creates a headless engine and `AdrawStore` immediately and `provide()`s the context key
2. `Canvas` mounts the provider-owned engine in `onMounted` and destroys its DOM adapter in `onUnmounted`
3. The store subscription copies the snapshot into a reactive `state` object and a `shallowRef` snapshot; hook getters read the snapshot
4. `useCanvas()` must be called synchronously during `setup()` (Vue `inject()` requirement)
5. `CanvasProvider` disposes the store when its scope unmounts; the engine/document survive a `<Canvas>` unmount
6. Multiple `<CanvasProvider>` instances can coexist (each provides its own context symbol)

## Build

```bash
pnpm vue:build    # build
pnpm vue:dev      # watch mode
```

## Code style

- `tsconfig.json` extends `@vue/tsconfig/tsconfig.dom.json` (not root tsconfig)
- No semicolons, double quotes, 2-space indent
- Reactive state via `reactive()`, canvas instance via `ref()`, snapshot via `shallowRef()`
- Read state from the snapshot; do not copy maps or sets in the adapter
- Vue-specific: `h()` for render functions, `InjectionKey` for provide/inject
