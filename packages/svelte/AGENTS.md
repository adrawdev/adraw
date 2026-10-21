# AGENTS.md — @adraw/svelte

## Purpose

Svelte 5 bindings for adraw. Uses Svelte 5 runes (`$state`, `$effect`, snippets) with a `CanvasProvider` context. Each provider subtree owns one canvas; multiple independent providers can coexist.

## Exports

From `src/index.ts`:

- `Canvas` — Svelte component (`src/Canvas.svelte`); renders mount container, creates/destroys canvas
- `CanvasProvider` — Svelte component (`src/CanvasProvider.svelte`); wraps children with context using Svelte 5 snippets
- `useCanvas()` — from `src/context.svelte.ts`; returns `CanvasContextValue`
- `useTool()` — `{ tool, setTool }`
- `useViewport()` — `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }`
- `useHistory()` — `{ undo, redo, canUndo, canRedo }`
- `useSelection()` — `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }`
- `useToolOptions()` — `{ toolOptions, setToolOptions }` (reactive getter + generic setter)
- `useStyle(tool?)` — `{ tool, style, setStyle }` reactive getters; infers from selection/active tool when omitted
- `useTransformOverlay()` — `{ hideWhileTransforming, setHideWhileTransforming }`
- `CanvasSvelteOptions` — type extending `CanvasOptions`
- `CanvasContextValue` — type for context value

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

1. `CanvasProvider` creates canvas context and provides it via Svelte 5's `setContext`/`getContext`
2. `Canvas` mounts the `AdrawCanvas` in a `$effect` block, subscribes to the core events (including `toolOptionsChange`)
3. `useCanvas()` returns the context set by the nearest ancestor `CanvasProvider` and throws outside one
4. One canvas per `CanvasProvider` subtree

## Build

```bash
pnpm build:svelte    # tsdown with rollup-plugin-svelte + svelteDtsPlugin for .d.ts
pnpm dev:svelte      # watch mode
```

## Build specifics

`tsdown.config.ts` uses custom plugins: `svelteModuleTypesPlugin()`, `rollup-plugin-svelte`, and `svelteDtsPlugin`. `.d.ts` generation is handled by `dts-buddy` through the plugin, not via tsdown's built-in `dts: true`.

## Code style

- Svelte 5 runes (`$state`, `$effect`, `{#snippet}`, `{@render}`) not Svelte 4 `$:`
- No semicolons, double quotes, 2-space indent
- `useCanvas()` reads the `CanvasProvider` context from `context.svelte.ts`
- Hooks return objects with getters (arrow functions for reactive reads) and methods
- Exported types: `CanvasContextValue`, `CanvasSvelteOptions`
- All methods no-op safely when canvas instance is `null`
