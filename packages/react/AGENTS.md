# AGENTS.md — @adraw/react

## Purpose

React bindings for adraw. Provides context-based hooks and a `Canvas` component that wraps `@adraw/core`'s `AdrawCanvas`.

## Exports

All exported from `src/index.ts` (re-exports from `src/components.tsx`):

- `CanvasProvider` — context provider; creates/owns the headless engine from `options?: CanvasReactOptions` and accepts `onReady?: (engine) => void`
- `Canvas` — renders the mount `<div>` and mounts/unmounts the provider-owned engine; must be inside `CanvasProvider`
- `useCanvas()` — returns the `CanvasContextValue` (engine, state, setters)
- `useCanvasEngine()` — returns `{ engine, isReady }`; `engine` is non-null from the first render and `isReady` flips after mount/subscriptions
- `useTool()` — returns `{ tool: ToolType, setTool: (t: ToolType) => void }`
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useToolOptions()` — returns `{ toolOptions, setToolOptions }` (resolved per-tool styles)
- `useStyle(tool?)` — returns `{ tool, style, setStyle }` for one tool, inferring from the selection/active tool when omitted
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

1. `CanvasProvider` creates a headless `new AdrawCanvas(options)` in a `useState` initializer (core applies `initialElements` / `initialDocument`) and seeds React state from the engine
2. `<Canvas>` only calls `engine.mount(container)` / `engine.destroy()` in an effect and toggles the provider's mounted flag
3. The provider subscribes to core events (including `toolOptionsChange`) in an effect, copies payloads into React state, and flips `isReady` after mount/subscriptions
4. `onReady(engine)` fires once per engine instance after those subscriptions exist
5. `setOptions` applies `tools` and `hideOverlayWhileTransforming` live; constructor-only options (`keyboard`, `snapping`, `viewport` config, `isSnapMode`, `clipboard` hooks, `measureText`) recreate the engine while preserving document, viewport and resolved tool styles
6. Hooks read/write through the context; the engine exists even before `<Canvas>` mounts
7. Multiple `<CanvasProvider>` instances can coexist on the same page (each has independent context)

## Build

```bash
pnpm build:react    # tsdown --minify
pnpm dev:react      # watch mode
```

## Code style

- `"use client"` directive at the top of `components.tsx` for SSR
- Follow React patterns — `useCallback`, `useMemo` as appropriate
- Canvas instance stored in `useState` (so engine replacement re-renders) plus a `vanillaRef` compatibility mirror
- Copy event payloads: `new Map(newElements)`, `new Set(newSelectedIds)`
- Same hook shape as all other adapters (shared surface)

## Creating a new hook

Add it to `CanvasContextValue` interface, wire it through `CanvasProvider` state, add a hook function, export from `src/index.ts`.
