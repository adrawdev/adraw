# AGENTS.md — @adraw/svelte

## Purpose

Svelte 5 adapter for adraw. Uses Svelte 5 runes (`$state`, `$effect`, snippets) with a `CanvasProvider` context. Each provider subtree owns one canvas; multiple independent providers can coexist.

## Exports

From `src/index.ts`:

- `Canvas` — Svelte component (`src/Canvas.svelte`); renders mount container, mounts/destroys the provider-owned engine
- `CanvasProvider` — Svelte component (`src/CanvasProvider.svelte`); wraps children with context using Svelte 5 snippets, accepts `onReady`
- `useCanvas()` — from `src/context.svelte.ts`; returns `CanvasContextValue` (includes `isReady`, `store` and `snapshot`)
- `useCanvasEngine()` — returns `{ engine, isReady }` with a reactive `isReady` getter
- `useTool()` — `{ tool, setTool }`
- `useViewport()` — `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — `{ undo, redo, canUndo, canRedo }`
- `useStyle()` — `{ style, setStyle }`
- `useSelection()` — `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }` (`elements` are the selected elements)
- `useTransformOverlay()` — `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasSvelteOptions` — type extending `CanvasOptions`
- `CanvasContextValue` — type for context value; its `state` field is the reactive adapter state projected from an `AdrawSnapshot`

## Usage

```svelte
<script lang="ts">
  import { CanvasProvider, Canvas, useTool, useViewport } from "@adraw/svelte"

  let { tool, setTool } = useTool()
  let { zoomIn, zoomOut } = useViewport()
</script>

<CanvasProvider>
  <div class="toolbar">
    <button onclick={() => setTool("rectangle")}>Rectangle</button>
    <button onclick={zoomIn}>Zoom In</button>
  </div>
  <Canvas class="w-full h-full" />
</CanvasProvider>
```

## How it works

1. `CanvasProvider` creates the headless engine and `AdrawStore` synchronously, then provides the context via Svelte 5's `setContext`/`getContext`
2. The context subscribes to the store and copies the snapshot into `$state`
3. `Canvas` mounts/unmounts the provider-owned engine in a `$effect` block; the store owns readiness and `onReady`
4. `CanvasProvider` disposes the store on destroy
5. `useCanvas()` returns the context set by the nearest ancestor `CanvasProvider` and throws outside one
6. One canvas per `CanvasProvider` subtree

## Build

```bash
pnpm svelte:build    # tsdown with rollup-plugin-svelte + svelteDtsPlugin for .d.ts
pnpm svelte:dev      # watch mode
```

## Build specifics

`tsdown.config.ts` uses custom plugins: `svelteModuleTypesPlugin()`, `rollup-plugin-svelte`, and `svelteDtsPlugin`. `.d.ts` generation is handled by `dts-buddy` through the plugin, not via tsdown's built-in `dts: true`.

## Code style

- Svelte 5 runes (`$state`, `$state.raw`, `$effect`, `{#snippet}`, `{@render}`) not Svelte 4 `$:`
- No semicolons, double quotes, 2-space indent
- `useCanvas()` reads the `CanvasProvider` context from `context.svelte.ts`
- Hooks return objects with getters (arrow functions for reactive reads) and methods
- Read state from the snapshot; do not copy maps or sets in the adapter
- Exported types: `CanvasContextValue`, `CanvasSvelteOptions`
- The engine exists from provider creation; use `isReady` before DOM-dependent work
