import type { ToolType } from "../types"

export interface ShortcutActions {
  clearSelection: () => void
  deleteSelected: () => void
  redo: () => boolean
  selectAll: () => void
  setActiveTool: (tool: ToolType) => void
  undo: () => boolean
}

// Keyboard shortcuts for the canvas. Pure — the engine (or any headless
// consumer) injects the operations it performs.
export function handleShortcutKey(
  event: KeyboardEvent,
  actions: ShortcutActions,
): void {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }

  const key = event.key.toLowerCase()

  if (event.ctrlKey || event.metaKey) {
    if (key === "z" && !event.shiftKey) {
      event.preventDefault()
      actions.undo()
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault()
      actions.redo()
    } else if (key === "a") {
      event.preventDefault()
      actions.selectAll()
    }
  } else {
    switch (key) {
      case "v": {
        actions.setActiveTool("select")
        break
      }
      case "h": {
        actions.setActiveTool("hand")
        break
      }
      case "d": {
        actions.setActiveTool("draw")
        break
      }
      case "e": {
        actions.setActiveTool("eraser")
        break
      }
      case "r": {
        actions.setActiveTool("rectangle")
        break
      }
      case "l": {
        actions.setActiveTool("line")
        break
      }
      case "t": {
        actions.setActiveTool("text")
        break
      }
      case "delete":
      case "backspace": {
        actions.deleteSelected()
        break
      }
      case "escape": {
        actions.clearSelection()
        break
      }
    }
  }
}
