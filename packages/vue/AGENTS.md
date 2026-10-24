# AGENTS.md — @adraw/vue

## Purpose

Vue 3 bindings for adraw. Provides composables and components via `provide`/`inject` with support for multiple independent canvas instances.

## Exports

All defined in `src/index.ts` (single file):

- `CanvasProvider` — component; pass `options?: CanvasVueOptions` and `onReady?: (engine) => void`
- `Canvas` — component; renders mount `<div>`, calls `core.mount()` on `onMounted`, `destroy()` on `onUnmounted`; must be inside `CanvasProvider`
- `createCanvas(options?, onReady?)` — factory: creates the headless engine and returns `{ core, isReady, markUnmounted, notifyReady, state, vanilla }`
- `useCanvas()` — injects nearest `CanvasProvider` context
- `useCanvasEngine()` — returns `{ engine, isReady }` with a reactive `isReady` getter
- `useTool()` — returns `{ tool, setTool }` (computed getter + method)
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasVueOptions` — interface extending `CanvasOptions` (adds `initialViewport`)
- `CanvasState` — reactive state interface
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

1. `CanvasProvider` calls `createCanvas(options, onReady)` in `setup()`; the factory creates a headless engine immediately and `provide()`s the context key
2. `Canvas` mounts the provider-owned engine in `onMounted`, calls `notifyReady()`, and destroys it in `onUnmounted`
3. Core events are subscribed in `createCanvas`, copying payloads into a reactive `state` object
4. `useCanvas()` must be called synchronously during `setup()` (Vue `inject()` requirement)
5. Multiple `<CanvasProvider>` instances can coexist (each provides its own context symbol)

## Build

```bash
pnpm vue:build    # build
pnpm vue:dev      # watch mode
```

## Code style

- `tsconfig.json` extends `@vue/tsconfig/tsconfig.dom.json` (not root tsconfig)
- No semicolons, double quotes, 2-space indent
- Reactive state via `reactive()`, canvas instance via `ref()`
- Copy event payloads into state: `new Map(newElements)`, `new Set(newSelectedIds)`
- Vue-specific: `h()` for render functions, `InjectionKey` for provide/inject
