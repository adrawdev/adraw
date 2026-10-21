# AGENTS.md — @adraw/solid

## Purpose

SolidJS bindings for adraw. Provides context-based primitives and a `CanvasProvider`/`Canvas` component pair supporting multiple independent canvas instances.

## Exports

All from `src/index.ts` (re-exports `src/components.tsx`):

- `CanvasProvider` — context provider; `options?: CanvasSolidOptions`
- `Canvas` — renders mount div, creates/destroys `AdrawCanvas` on mount/unmount; must be inside `CanvasProvider`
- `useCanvas()` — returns `CanvasContextValue`
- `useTool()` — returns `{ tool, setTool }`
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useToolOptions()` — returns `{ toolOptions, setToolOptions }` (reactive getter + generic setter)
- `useStyle(tool?)` — returns `{ tool, style, setStyle }` reactive getters; infers from selection/active tool when omitted
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

1. `CanvasProvider` creates signals via `createSignal()` and provides context
2. Also tracks `canUndo`/`canRedo` as separate signals (Solid can't access them synchronously after element changes)
3. `Canvas` creates `AdrawCanvas` in `onMount`, subscribes to the core events (including `toolOptionsChange`), copies payloads into signals
4. History sync uses `queueMicrotask` to read undo/redo state after the current handler finishes
5. Multiple `<CanvasProvider>` instances can coexist

## Build & test

```bash
pnpm build:solid    # tsdown --minify with rolldown-plugin-solid
pnpm dev:solid      # watch mode
pnpm lint                    # from root
```

## Build specifics

`tsdown.config.ts` uses `rolldown-plugin-solid` for JSX transform. `tsconfig.json` has `"jsx": "preserve"` and `"jsxImportSource": "solid-js"`.

## Code style

- Solid signals (`createSignal`, `createContext`, `onMount`, `onCleanup`) — no JSX transform needed beyond `rolldown-plugin-solid`
- Canvas instance stored in a plain `{ current: null }` ref object, not a signal
- `createComponent` used for context provider (Solid JSX)
- All methods no-op safely when canvas is not mounted
- Same hook shape as React adapter (shared surface)
