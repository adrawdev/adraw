# AGENTS.md — @adraw/react

## Purpose

React adapter for adraw. Provides context-based hooks and a `Canvas` component that wraps `@adraw/core`'s `AdrawCanvas`.

## Exports

All exported from `src/index.ts` (re-exports from `src/components.tsx`):

- `CanvasProvider` — context provider; creates/owns the headless engine and `AdrawStore` from `options?: CanvasReactOptions` and accepts `onReady?: (engine) => void`
- `Canvas` — renders the mount `<div>` and mounts/unmounts the provider-owned engine; must be inside `CanvasProvider`
- `useCanvas()` — returns the `CanvasContextValue` (engine, store, snapshot, state, setters)
- `useCanvasEngine()` — returns `{ engine, isReady }`; `engine` is non-null from the first render and `isReady` flips after mount
- `useTool()` — returns `{ tool: ToolType, setTool: (t: ToolType) => void }`
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`; `canUndo`/`canRedo` read the snapshot
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`; `elements` are the selected elements
- `useStyle()` — returns `{ style, setStyle }`
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasReactOptions` — type extending `CanvasOptions` (which includes `initialElements` / `initialDocument`)

## Usage

```tsx
import { CanvasProvider, Canvas, useTool, useViewport } from "@adraw/react"

function App() {
  return (
    <CanvasProvider>
      <Toolbar />
      <Canvas className="w-full h-full" />
    </CanvasProvider>
  )
}

function Toolbar() {
  const { tool, setTool } = useTool()
  const { zoomIn, zoomOut } = useViewport()
  return (
    <div>
      <button onClick={() => setTool("rectangle")}>Rectangle</button>
      <button onClick={zoomIn}>Zoom In</button>
    </div>
  )
}
```

## How it works

1. `CanvasProvider` creates a headless `new AdrawCanvas(options)` and an `AdrawStore` in a `useState` initializer (core applies `initialElements` / `initialDocument`)
2. `<Canvas>` only calls `engine.mount(container)` / `engine.destroy()` in an effect
3. The provider reads the store through `useSyncExternalStore`; the store owns subscriptions, snapshot slicing, readiness and `onReady`
4. `onReady(engine)` fires once per engine instance when it first mounts
5. `setOptions` applies `hideOverlayWhileTransforming` and `isToolLocked` live; constructor-only options (`keyboard`, `snapping`, `viewport` config, `isSnapMode`, `clipboard` hooks, `measureText`) recreate the engine and store while preserving the document and viewport
6. Hooks read the snapshot through the context; the engine exists even before `<Canvas>` mounts
7. Multiple `<CanvasProvider>` instances can coexist on the same page (each has independent context)

## Build

```bash
pnpm react:build    # build
pnpm react:dev      # watch mode
```

## Code style

- `"use client"` directive at the top of `components.tsx` for SSR
- Follow React patterns — `useCallback`, `useMemo` as appropriate
- Canvas instance and store are held together in `useState` so engine replacement re-renders
- Read state from the store snapshot; do not copy maps or sets in the adapter
- Same hook shape as all other adapters (shared surface)

## Creating a new hook

Add it to `CanvasContextValue` interface, read the needed slice from `snapshot`, add a hook function, export from `src/index.ts`.
