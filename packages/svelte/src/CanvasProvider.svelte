<script lang="ts">
import type { AdrawCanvas } from "@adraw/core"
import type { Snippet } from "svelte"
import { createCanvasContext, type CanvasSvelteOptions } from "./context.svelte.ts"

interface Props {
  children: Snippet
  options?: CanvasSvelteOptions
  onReady?: (engine: AdrawCanvas) => void
}

let { children, onReady, options }: Props = $props()

createCanvasContext(
  () => options,
  () => onReady,
)
</script>

{@render children()}
