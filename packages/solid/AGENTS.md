# AGENTS.md — @adraw/solid

## Purpose

SolidJS bindings for adraw. Provides context-based primitives and a `CanvasProvider`/`Canvas` component pair supporting multiple independent canvas instances.

## Exports

All from `src/index.ts` (re-exports `src/components.tsx`):

- `CanvasProvider` — context provider; `options?: CanvasSolidOptions`, `onReady?: (engine) => void`; creates the headless engine synchronously
- `Canvas` — renders mount div, mounts/destroys the provider-owned `AdrawCanvas`; must be inside `CanvasProvider`
- `useCanvas()` — returns `CanvasContextValue` (includes `isReady`)
- `useCanvasEngine()` — returns `{ engine, isReady }` with a reactive `isReady` accessor
- `useTool()` — returns `{ tool, setTool }`
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasSolidOptions` — type extending `CanvasOptions`

## Usage

```tsx
import { CanvasProvider, Canvas, useTool, useViewport } from "@adraw/solid"

function App() {
  return (
    <CanvasProvider>
      <Toolbar />
      <Canvas class="w-full h-full" />
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

1. `CanvasProvider` creates the headless `AdrawCanvas` synchronously, seeds signals from it, and provides context
2. The provider subscribes to core events and copies payloads into signals
3. `Canvas` only mounts/unmounts the provider-owned engine and toggles `isMounted`; `onReady` fires once after mount
4. History sync uses `queueMicrotask` to read undo/redo state after the current handler finishes
5. Multiple `<CanvasProvider>` instances can coexist

## Build & test

```bash
pnpm solid:build    # build
pnpm solid:dev      # watch mode
pnpm lint                    # from root
```

## Build specifics

`tsdown.config.ts` uses `rolldown-plugin-solid` for JSX transform. `tsconfig.json` has `"jsx": "preserve"` and `"jsxImportSource": "solid-js"`.

## Code style

- Solid signals (`createSignal`, `createContext`, `onMount`, `onCleanup`) — no JSX transform needed beyond `rolldown-plugin-solid`
- Canvas instance stored in a plain `{ current: AdrawCanvas }` ref object created by the provider, not a signal
- `createComponent` used for context provider (Solid JSX)
- Engine methods are safe before `<Canvas>` mounts; use `isReady` for DOM-dependent work
- Same hook shape as React adapter (shared surface)
