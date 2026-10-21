# AGENTS.md — @adraw/react

## Purpose

React bindings for adraw. Provides context-based hooks and a `Canvas` component that wraps `@adraw/core`'s `AdrawCanvas`.

## Exports

All exported from `src/index.ts` (re-exports from `src/components.tsx`):

- `CanvasProvider` — context provider; pass `options?: CanvasReactOptions`
- `Canvas` — renders the mount `<div>`, creates/destroys `AdrawCanvas` on mount/unmount; must be inside `CanvasProvider`
- `useCanvas()` — returns the `CanvasContextValue` (refs, state, setters)
- `useTool()` — returns `{ tool: ToolType, setTool: (t: ToolType) => void }`
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useToolOptions()` — returns `{ toolOptions, setToolOptions }` (resolved per-tool styles)
- `useStyle(tool?)` — returns `{ tool, style, setStyle }` for one tool, inferring from the selection/active tool when omitted
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasReactOptions` — type extending `CanvasOptions`

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

1. `CanvasProvider` creates context with state signals (`useState`) and a `useRef` for the canvas instance
2. `Canvas` creates `new AdrawCanvas({ container, ...options })` in `useEffect`, subscribes to the core events (including `toolOptionsChange`), copies payloads into React state
3. Hooks read/write through the context — all methods no-op when canvas isn't mounted (ref is null)
4. Multiple `<CanvasProvider>` instances can coexist on the same page (each has independent context)

## Build

```bash
pnpm build:react    # tsdown --minify
pnpm dev:react      # watch mode
```

## Code style

- `"use client"` directive at the top of `components.tsx` for SSR
- Follow React patterns — `useCallback`, `useMemo` as appropriate
- Canvas instance stored in `useRef`, not state
- Copy event payloads: `new Map(newElements)`, `new Set(newSelectedIds)`
- Same hook shape as all other adapters (shared surface)

## Creating a new hook

Add it to `CanvasContextValue` interface, wire it through `CanvasProvider` state, add a hook function, export from `src/index.ts`.
