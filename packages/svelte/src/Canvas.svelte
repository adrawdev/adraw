<script lang="ts">
import { useCanvas } from "./context.svelte.ts"

interface Props {
  class?: string
  style?: string
}

let { class: className, style }: Props = $props()

const context = useCanvas()

let container: HTMLDivElement

$effect(() => {
  const canvas = context.instance.current

  canvas.mount(container)

  return () => {
    canvas.destroy()
  }
})
</script>

<div
  bind:this={container}
  class={className}
  style={`height: 100%; width: 100%; ${style ?? ""}`}
></div>
