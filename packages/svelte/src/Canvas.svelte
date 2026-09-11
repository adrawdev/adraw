<script lang="ts">
import { AdrawCanvas, type CanvasEventMap } from "@adraw/core"
import { useCanvas } from "./context.svelte.ts"

interface Props {
  class?: string
  style?: string
}

let { class: className, style }: Props = $props()

const context = useCanvas()

let container: HTMLDivElement

$effect(() => {
  const canvas = new AdrawCanvas({
    container,
    hideOverlayWhileTransforming: context.options?.hideOverlayWhileTransforming,
    initialViewport: context.options?.initialViewport,
    isSnapMode: context.options?.isSnapMode,
    snapping: context.options?.snapping,
  })

  context.instance.current = canvas

  canvas.on("change", ({ elements }: CanvasEventMap["change"]) => {
    context.state.elements = new Map(elements)
  })

  canvas.on(
    "viewportChange",
    ({ viewport }: CanvasEventMap["viewportChange"]) => {
      context.state.viewport = viewport
    },
  )

  canvas.on("toolChange", ({ tool }: CanvasEventMap["toolChange"]) => {
    context.state.activeTool = tool
  })

  canvas.on(
    "selectionChange",
    ({ selectedIds }: CanvasEventMap["selectionChange"]) => {
      context.state.selectedIds = new Set(selectedIds)
    },
  )

  return () => {
    context.instance.current?.destroy()
    context.instance.current = null
  }
})
</script>

<div
  bind:this={container}
  class={className}
  style={`height: 100%; width: 100%; ${style ?? ""}`}
></div>
