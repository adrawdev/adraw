<script lang="ts">
import type { AdrawCanvas } from "@adraw/core"
import { onDestroy, type Snippet } from "svelte"
import { createCanvasContext, type CanvasSvelteOptions } from "./context.svelte.ts"

interface Props {
  children: Snippet
  options?: CanvasSvelteOptions
  onReady?: (engine: AdrawCanvas) => void
}

let { children, onReady, options }: Props = $props()

const context = createCanvasContext(
  () => options,
  () => onReady,
)

onDestroy(() => context.dispose())
</script>

{@render children()}
