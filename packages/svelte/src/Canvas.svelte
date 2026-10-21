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
    ...context.options,
    container,
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

  canvas.on(
    "toolOptionsChange",
    ({ tool, options }: CanvasEventMap["toolOptionsChange"]) => {
      context.state.toolOptions = {
        ...context.state.toolOptions,
        [tool]: options,
      } as typeof context.state.toolOptions
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
