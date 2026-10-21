import type { ToolType } from "../types"

export interface ShortcutActions {
  clearSelection: () => void
  copy: () => void
  cut: () => void
  deleteSelected: () => void
  paste: () => void
  redo: () => boolean
  selectAll: () => void
  setActiveTool: (tool: ToolType) => void
  undo: () => boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }

  return target instanceof HTMLElement && target.isContentEditable
}

// Keyboard shortcuts for the canvas. Pure — the engine (or any headless
// consumer) injects the operations it performs.
export function handleShortcutKey(
  event: KeyboardEvent,
  actions: ShortcutActions,
): void {
  if (isEditableTarget(event.target)) {
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
    } else if (key === "c") {
      event.preventDefault()
      actions.copy()
    } else if (key === "x") {
      event.preventDefault()
      actions.cut()
    } else if (key === "v") {
      event.preventDefault()
      actions.paste()
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
      case "a": {
        actions.setActiveTool("arrow")
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
