import type { CanvasElement, ElementId } from "./types"

/**
 * A single undo/redo checkpoint.
 */
export interface HistoryEntry {
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
  timestamp: number
}

/**
 * Stack-based history state managed outside the canvas.
 */
export interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  maxSize: number
}

/**
 * Create a fresh history state.
 *
 * @param maxSize Maximum number of checkpoints retained.
 */
export function createHistoryState(maxSize: number = 100): HistoryState {
  return {
    maxSize,
    redoStack: [],
    undoStack: [],
  }
}

/**
 * Push a checkpoint onto the undo stack, clearing the redo stack.
 * The submitted state is copied so callers can keep mutating.
 *
 * @param state Current history state.
 * @param elements Current elements map.
 * @param selectedIds Current selection.
 * @returns A new history state.
 */
export function pushHistory(
  state: HistoryState,
  elements: Map<ElementId, CanvasElement>,
  selectedIds: Set<ElementId>,
): HistoryState {
  const entry: HistoryEntry = {
    elements: new Map(elements),
    selectedIds: new Set(selectedIds),
    timestamp: Date.now(),
  }

  const newUndoStack = [...state.undoStack, entry]

  if (newUndoStack.length > state.maxSize) {
    newUndoStack.shift()
  }

  return {
    maxSize: state.maxSize,
    redoStack: [],
    undoStack: newUndoStack,
  }
}

/**
 * Restore the previous checkpoint, pushing the current state onto the redo
 * stack. Returns `null` when there is nothing to undo.
 *
 * @param state Current history state.
 * @param currentElements Elements currently on the canvas.
 * @param currentSelectedIds Current selection.
 * @returns The restored elements/selection and new history state, or `null`.
 */
export function undo(
  state: HistoryState,
  currentElements: Map<ElementId, CanvasElement>,
  currentSelectedIds: Set<ElementId>,
): {
  state: HistoryState
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
} | null {
  // The top of the undo stack mirrors the current committed state, so undoing
  // requires at least one prior checkpoint underneath it to restore.
  if (state.undoStack.length <= 1) {
    return null
  }

  const newUndoStack = [...state.undoStack]
  newUndoStack.pop()
  const targetEntry = newUndoStack[newUndoStack.length - 1]

  const currentEntry: HistoryEntry = {
    elements: new Map(currentElements),
    selectedIds: new Set(currentSelectedIds),
    timestamp: Date.now(),
  }

  return {
    elements: new Map(targetEntry.elements),
    selectedIds: new Set(targetEntry.selectedIds),
    state: {
      maxSize: state.maxSize,
      redoStack: [...state.redoStack, currentEntry],
      undoStack: newUndoStack,
    },
  }
}

/**
 * Re-apply the most recently undone checkpoint. Returns `null` when the redo
 * stack is empty.
 *
 * @param state Current history state.
 * @returns The restored elements/selection and new history state, or `null`.
 */
export function redo(
  state: HistoryState,
  _currentElements: Map<ElementId, CanvasElement>,
  _currentSelectedIds: Set<ElementId>,
): {
  state: HistoryState
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
} | null {
  if (state.redoStack.length === 0) {
    return null
  }

  const newRedoStack = [...state.redoStack]
  const targetEntry = newRedoStack.pop()!

  return {
    elements: new Map(targetEntry.elements),
    selectedIds: new Set(targetEntry.selectedIds),
    state: {
      maxSize: state.maxSize,
      redoStack: newRedoStack,
      // The restored state becomes the new current committed checkpoint.
      undoStack: [...state.undoStack, targetEntry],
    },
  }
}

/**
 * Whether undo is currently possible.
 */
export function canUndo(state: HistoryState): boolean {
  return state.undoStack.length > 1
}

/**
 * Whether redo is currently possible.
 */
export function canRedo(state: HistoryState): boolean {
  return state.redoStack.length > 0
}

/**
 * Clear both undo and redo stacks.
 */
export function clearHistory(state: HistoryState): HistoryState {
  return {
    ...state,
    redoStack: [],
    undoStack: [],
  }
}
