<script setup lang="ts">
import type { ToolType } from "@adraw/core"
import { useHistory, useTool, useViewport } from "@adraw/vue"

defineProps<{ label: string }>()

const toolApi = useTool()
const viewportApi = useViewport()
const historyApi = useHistory()

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

<template>
  <div class="toolbar">
    <span class="label">{{ label }}</span>
    <button
      v-for="tool in tools"
      :key="tool.id"
      :class="{ active: toolApi.tool === tool.id }"
      @click="toolApi.setTool(tool.id)"
      :title="`${tool.label} (${tool.shortcut})`"
    >
      {{ tool.label }}
    </button>
    <div class="separator" />
    <button :disabled="!historyApi.canUndo()" @click="historyApi.undo()">
      Undo
    </button>
    <button :disabled="!historyApi.canRedo()" @click="historyApi.redo()">
      Redo
    </button>
    <div class="separator" />
    <button @click="viewportApi.zoomIn()">+</button>
    <button @click="viewportApi.zoomOut()">-</button>
    <button @click="viewportApi.zoomToFit()">Fit</button>
    <button @click="viewportApi.resetZoom()">Reset</button>
  </div>
</template>

<style>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}
.label {
  font-weight: 600;
  font-size: 13px;
  margin-right: 8px;
  color: #555;
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
.toolbar button:disabled {
  cursor: default;
  opacity: 0.5;
}
.separator {
  background: #ddd;
  margin: 0 4px;
  width: 1px;
}
</style>
