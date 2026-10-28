import { syncArrowBindings } from "../arrow-bindings"
import { syncGroupState } from "../groups"
import {
  canRedo as canRedoHistory,
  canUndo as canUndoHistory,
  createHistoryState,
  pushHistory as pushHistoryState,
  redo as redoHistory,
  undo as undoHistory,
  type HistoryEntry,
  type HistoryState,
} from "../history"
import type { TextMeasurer } from "../text"
import { syncTextBindings } from "../text-bindings"
import type { CanvasElement, ElementId } from "../types"

/**
 * The state a commit is allowed to change. `elements` and `selectedIds` are
 * copies of the scene's current state, so a mutator can edit them freely; the
 * scene only adopts them when the commit succeeds.
 */
export interface SceneDraft {
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
}

/**
 * What a scene operation changed. The engine composes these flags with any
 * other state changes into one operation-scoped publication.
 */
export interface SceneChange {
  readonly elementsChanged: boolean
  readonly historyChanged: boolean
  readonly selectionChanged: boolean
}

/**
 * Options for {@link Scene.commit}.
 */
export interface SceneCommitOptions {
  /** Record a history checkpoint after the commit. Defaults to `false`. */
  history?: boolean
}

/**
 * Options for {@link Scene.replace}.
 */
export interface SceneReplaceOptions {
  /** Record a history checkpoint after the replacement. Defaults to `false`. */
  history?: boolean
  /**
   * Selection after the replacement. `"keep"` clamps the current selection to
   * the new elements, `"clear"` selects nothing, and an iterable selects those
   * ids (clamped to the elements that exist).
   */
  selection?: "clear" | "keep" | Iterable<ElementId>
}

/**
 * Dependencies the scene needs from its owner.
 */
export interface SceneOptions {
  /** Read the measurer used to lay out bound text during binding sync. */
  getTextMeasurer: () => TextMeasurer
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  )
}

function clampSelection(
  selection: Set<ElementId>,
  elements: Map<ElementId, CanvasElement>,
): void {
  for (const id of selection) {
    if (!elements.has(id)) {
      selection.delete(id)
    }
  }
}

function resolveSelection(
  selection: SceneReplaceOptions["selection"],
  current: Set<ElementId>,
): Set<ElementId> {
  if (selection === "clear") {
    return new Set()
  }
  if (selection === undefined || selection === "keep") {
    return new Set(current)
  }
  return new Set(selection)
}

function sameElements(
  a: Map<ElementId, CanvasElement>,
  b: Map<ElementId, CanvasElement>,
): boolean {
  if (a === b) {
    return true
  }
  if (a.size !== b.size) {
    return false
  }
  for (const [id, element] of a) {
    if (b.get(id) !== element) {
      return false
    }
  }
  return true
}

function sameSelection(a: Set<ElementId>, b: Set<ElementId>): boolean {
  if (a === b) {
    return true
  }
  if (a.size !== b.size) {
    return false
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false
    }
  }
  return true
}

/**
 * Owns the canvas content — elements, selection and undo history — and applies
 * changes atomically. A `commit` edits a copy, syncs derived bindings, clamps
 * the selection, optionally records a checkpoint, and only then replaces the
 * scene state. The engine keeps viewport, tool, style and snapping.
 *
 * @internal
 */
export class Scene {
  private elements = new Map<ElementId, CanvasElement>()
  private selectedIds = new Set<ElementId>()
  private history: HistoryState
  private historySuppressionDepth = 0
  private committing = false
  private readonly getTextMeasurer: () => TextMeasurer

  constructor(options: SceneOptions) {
    this.getTextMeasurer = options.getTextMeasurer
    this.history = pushHistoryState(
      createHistoryState(),
      this.elements,
      this.selectedIds,
    )
  }

  /**
   * The live element map. Callers that store it must copy first.
   */
  getElements(): Map<ElementId, CanvasElement> {
    return this.elements
  }

  /**
   * The live selection set. Callers that store it must copy first.
   */
  getSelectedIds(): Set<ElementId> {
    return this.selectedIds
  }

  /**
   * Apply an atomic change to a copy of the scene. The mutator must be
   * synchronous and must replace element records instead of mutating them in
   * place.
   */
  commit(
    mutator: (draft: SceneDraft) => void,
    options: SceneCommitOptions = {},
  ): SceneChange {
    this.assertNotCommitting()
    this.committing = true
    try {
      const beforeElements = this.elements
      const beforeSelection = this.selectedIds
      const draft: SceneDraft = {
        elements: new Map(beforeElements),
        selectedIds: new Set(beforeSelection),
      }

      const result = (mutator as (draft: SceneDraft) => unknown)(draft)
      if (isPromiseLike(result)) {
        throw new TypeError("Scene.commit: mutator must be synchronous")
      }
      if (
        !(draft.elements instanceof Map) ||
        !(draft.selectedIds instanceof Set)
      ) {
        throw new TypeError(
          "Scene.commit: draft elements and selection must stay a Map and a Set",
        )
      }
      if (
        draft.elements === beforeElements ||
        draft.selectedIds === beforeSelection
      ) {
        throw new Error(
          "Scene.commit: mutator must not reuse live scene collections",
        )
      }

      this.syncBindings(draft.elements, draft.selectedIds)
      syncGroupState(draft.elements)
      clampSelection(draft.selectedIds, draft.elements)

      const elementsChanged = !sameElements(beforeElements, draft.elements)
      const selectionChanged = !sameSelection(
        beforeSelection,
        draft.selectedIds,
      )
      if (!elementsChanged && !selectionChanged) {
        return this.noChange()
      }

      this.elements = draft.elements
      this.selectedIds = draft.selectedIds
      const historyChanged = this.maybeCheckpoint(options.history)
      return {
        elementsChanged,
        historyChanged,
        selectionChanged,
      }
    } finally {
      this.committing = false
    }
  }

  /**
   * Adopt a caller-built element map. Used by the hot tool path, bulk document
   * loads and z-order operations where the caller already owns a fresh map.
   */
  replace(
    elements: Map<ElementId, CanvasElement>,
    options: SceneReplaceOptions = {},
  ): SceneChange {
    this.assertNotCommitting()
    this.committing = true
    try {
      const beforeSelection = this.selectedIds
      const nextElements =
        elements === this.elements ? new Map(elements) : elements
      const nextSelection = resolveSelection(options.selection, beforeSelection)

      this.syncBindings(nextElements, nextSelection)
      syncGroupState(nextElements)
      clampSelection(nextSelection, nextElements)

      const selectionChanged = !sameSelection(beforeSelection, nextSelection)
      this.elements = nextElements
      this.selectedIds = nextSelection
      const historyChanged = this.maybeCheckpoint(options.history)
      return {
        elementsChanged: true,
        historyChanged,
        selectionChanged,
      }
    } finally {
      this.committing = false
    }
  }

  /**
   * Replace the selection without touching elements or history.
   */
  select(ids: Iterable<ElementId>): SceneChange {
    this.assertNotCommitting()
    const next = new Set(ids)
    clampSelection(next, this.elements)
    this.selectedIds = next
    return {
      elementsChanged: false,
      historyChanged: false,
      selectionChanged: true,
    }
  }

  /**
   * Record the current state as an undo checkpoint. No-op while inside
   * {@link Scene.withoutHistory}.
   */
  checkpoint(): SceneChange {
    this.assertNotCommitting()
    if (this.historySuppressionDepth > 0) {
      return this.noChange()
    }
    this.history = pushHistoryState(
      this.history,
      this.elements,
      this.selectedIds,
    )
    return {
      elementsChanged: false,
      historyChanged: true,
      selectionChanged: false,
    }
  }

  /**
   * Undo the last checkpoint. The returned change is empty when unavailable.
   */
  undo(): SceneChange {
    this.assertNotCommitting()
    const result = undoHistory(this.history, this.elements, this.selectedIds)
    if (!result) {
      return this.noChange()
    }

    this.elements = result.elements
    syncArrowBindings(this.elements)
    syncGroupState(this.elements)
    this.selectedIds = result.selectedIds
    clampSelection(this.selectedIds, this.elements)
    this.history = result.state
    return {
      elementsChanged: true,
      historyChanged: true,
      selectionChanged: true,
    }
  }

  /**
   * Redo the last undone checkpoint. The returned change is empty when
   * unavailable.
   */
  redo(): SceneChange {
    this.assertNotCommitting()
    const result = redoHistory(this.history, this.elements, this.selectedIds)
    if (!result) {
      return this.noChange()
    }

    this.elements = result.elements
    syncArrowBindings(this.elements)
    syncGroupState(this.elements)
    this.selectedIds = result.selectedIds
    clampSelection(this.selectedIds, this.elements)
    this.history = result.state
    return {
      elementsChanged: true,
      historyChanged: true,
      selectionChanged: true,
    }
  }

  canUndo(): boolean {
    return canUndoHistory(this.history)
  }

  canRedo(): boolean {
    return canRedoHistory(this.history)
  }

  /**
   * Reset undo and redo history, keeping the current state as the baseline.
   */
  clearHistory(): SceneChange {
    this.assertNotCommitting()
    this.history = pushHistoryState(
      createHistoryState(this.history.maxSize),
      this.elements,
      this.selectedIds,
    )
    return {
      elementsChanged: false,
      historyChanged: true,
      selectionChanged: false,
    }
  }

  /**
   * Run a function with history recording suppressed. Changes are folded into
   * existing checkpoints on finish so undo/redo preserves them. Nested calls
   * coalesce; async callbacks keep history suppressed until they settle.
   */
  withoutHistory<T>(fn: () => T): T {
    this.assertNotCommitting()
    const before = new Map(this.elements)
    this.historySuppressionDepth += 1

    const finish = (): void => {
      this.historySuppressionDepth -= 1
      if (this.historySuppressionDepth === 0) {
        this.rebaseHistory(before)
      }
    }

    try {
      const result = fn()
      if (isPromiseLike(result)) {
        return Promise.resolve(result).finally(finish) as T
      }
      finish()
      return result
    } catch (error) {
      finish()
      throw error
    }
  }

  // Recompute derived bindings on a candidate map and drop selected ids that
  // disappeared while syncing. Returns whether the element map changed.
  private syncBindings(
    elements: Map<ElementId, CanvasElement>,
    selectedIds: Set<ElementId>,
  ): boolean {
    let changed = syncArrowBindings(elements)
    const textChanged = syncTextBindings(elements, this.getTextMeasurer())
    if (textChanged) {
      changed = true
      syncArrowBindings(elements)
      for (const id of selectedIds) {
        if (!elements.has(id)) {
          selectedIds.delete(id)
        }
      }
    }
    return changed
  }

  private maybeCheckpoint(history: boolean | undefined): boolean {
    if (!history || this.historySuppressionDepth > 0) {
      return false
    }
    this.history = pushHistoryState(
      this.history,
      this.elements,
      this.selectedIds,
    )
    return true
  }

  // Fold the net change made outside history into every checkpoint, so undo
  // and redo preserve those changes instead of dropping them.
  private rebaseHistory(before: Map<ElementId, CanvasElement>): boolean {
    const added = new Map<ElementId, CanvasElement>()
    const changed = new Map<ElementId, CanvasElement>()
    const removed = new Set<ElementId>()

    for (const [id, element] of this.elements) {
      const previous = before.get(id)
      if (previous === undefined) {
        added.set(id, element)
      } else if (previous !== element) {
        changed.set(id, element)
      }
    }
    for (const id of before.keys()) {
      if (!this.elements.has(id)) {
        removed.add(id)
      }
    }

    if (added.size === 0 && changed.size === 0 && removed.size === 0) {
      return false
    }

    const rebaseEntries = (entries: HistoryEntry[]): HistoryEntry[] =>
      entries.map((entry) => {
        const elements = new Map(entry.elements)
        for (const [id, element] of added) {
          elements.set(id, element)
        }
        for (const [id, element] of changed) {
          if (elements.has(id)) {
            elements.set(id, element)
          }
        }
        for (const id of removed) {
          elements.delete(id)
        }

        const selectedIds = new Set(entry.selectedIds)
        for (const id of removed) {
          selectedIds.delete(id)
        }

        return { elements, selectedIds, timestamp: entry.timestamp }
      })

    this.history = {
      ...this.history,
      redoStack: rebaseEntries(this.history.redoStack),
      undoStack: rebaseEntries(this.history.undoStack),
    }
    return true
  }

  private noChange(): SceneChange {
    return {
      elementsChanged: false,
      historyChanged: false,
      selectionChanged: false,
    }
  }

  private assertNotCommitting(): void {
    if (this.committing) {
      throw new Error("Scene: reentrant commits are not allowed")
    }
  }
}
