import type { ToolType } from "../types"

export interface ShortcutActions {
  copy: () => void
  cut: () => void
  deleteSelected: () => void
  duplicate: () => void
  /** Leave the entered group one level, or clear the selection at the top. */
  escapeSelection: () => void
  getIsToolLocked: () => boolean
  group: () => void
  hasSelection: () => boolean
  nudgeSelection: (dx: number, dy: number) => void
  paste: () => void
  redo: () => boolean
  resetZoom: () => void
  selectAll: () => void
  setActiveTool: (tool: ToolType) => void
  setIsToolLocked: (locked: boolean) => void
  undo: () => boolean
  ungroup: () => void
  zoomIn: () => void
  zoomOut: () => void
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
    } else if (key === "d") {
      event.preventDefault()
      actions.duplicate()
    } else if (key === "=" || key === "+") {
      event.preventDefault()
      actions.zoomIn()
    } else if (key === "-" || key === "_") {
      event.preventDefault()
      actions.zoomOut()
    } else if (key === "0") {
      event.preventDefault()
      actions.resetZoom()
    } else if (key === "g") {
      event.preventDefault()
      if (event.shiftKey) {
        actions.ungroup()
      } else {
        actions.group()
      }
    }
  } else {
    const step = event.shiftKey ? 10 : 1
    switch (key) {
      case "arrowup": {
        if (actions.hasSelection()) {
          event.preventDefault()
          actions.nudgeSelection(0, -step)
        }
        break
      }
      case "arrowdown": {
        if (actions.hasSelection()) {
          event.preventDefault()
          actions.nudgeSelection(0, step)
        }
        break
      }
      case "arrowleft": {
        if (actions.hasSelection()) {
          event.preventDefault()
          actions.nudgeSelection(-step, 0)
        }
        break
      }
      case "arrowright": {
        if (actions.hasSelection()) {
          event.preventDefault()
          actions.nudgeSelection(step, 0)
        }
        break
      }
      case "v": {
        actions.setActiveTool("select")
        break
      }
      case "h": {
        actions.setActiveTool("hand")
        break
      }
      case "d": {
        actions.setActiveTool("diamond")
        break
      }
      case "e": {
        actions.setActiveTool("eraser")
        break
      }
      case "p": {
        actions.setActiveTool("draw")
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
      case "n": {
        actions.setActiveTool("note")
        break
      }
      case "q": {
        actions.setIsToolLocked(!actions.getIsToolLocked())
        break
      }
      case "delete":
      case "backspace": {
        actions.deleteSelected()
        break
      }
      case "escape": {
        actions.escapeSelection()
        break
      }
    }
  }
}
