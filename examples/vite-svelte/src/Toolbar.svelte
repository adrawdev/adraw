<script lang="ts">
import type { ToolType } from "@adraw/core"
import { useHistory, useTool, useViewport } from "@adraw/svelte"

const tool = useTool()
const viewport = useViewport()
const history = useHistory()

const tools: { id: ToolType; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "hand", label: "Hand", shortcut: "H" },
  { id: "rectangle", label: "Rectangle", shortcut: "R" },
  { id: "ellipse", label: "Ellipse", shortcut: "E" },
  { id: "draw", label: "Draw", shortcut: "D" },
  { id: "eraser", label: "Eraser", shortcut: "E" },
  { id: "text", label: "Text", shortcut: "T" },
]
</script>

<div class="toolbar">
  {#each tools as t (t.id)}
    <button
      type="button"
      class:active={tool.tool === t.id}
      onclick={() => tool.setTool(t.id)}
      title={`${t.label} (${t.shortcut})`}
    >
      {t.label}
    </button>
  {/each}
  <div class="separator"></div>
  <button type="button" onclick={history.undo} disabled={!history.canUndo()}>
    Undo
  </button>
  <button type="button" onclick={history.redo} disabled={!history.canRedo()}>
    Redo
  </button>
  <div class="separator"></div>
  <button type="button" onclick={viewport.zoomIn}>+</button>
  <button type="button" onclick={viewport.zoomOut}>-</button>
  <button type="button" onclick={viewport.zoomToFit}>Fit</button>
  <button type="button" onclick={viewport.resetZoom}>Reset</button>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }
  .toolbar button {
    padding: 8px 12px;
    border: 1px solid #ccc;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  .toolbar button:hover {
    background: #e8e8e8;
  }
  .toolbar button.active {
    background: #2196f3;
    color: white;
    border-color: #1976d2;
  }
  .separator {
    width: 1px;
    margin: 0 8px;
    background: #ddd;
  }
</style>
