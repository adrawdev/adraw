import { syncArrowBindings } from "../arrow-bindings"
import {
  collectSubtreeIds,
  createGroupIndex,
  getSelectableChildren,
} from "../groups"
import type { CanvasElement, ElementId } from "../types"

export function selectAllIds(
  elements: Map<ElementId, CanvasElement>,
  contextId: ElementId | null = null,
): Set<ElementId> {
  const index = createGroupIndex(elements)
  return new Set(getSelectableChildren(index, contextId))
}

export interface DeleteSelectedResult {
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
  deletedIds: Set<ElementId>
}

export function deleteSelectedElements(
  elements: Map<ElementId, CanvasElement>,
  selectedIds: Set<ElementId>,
): DeleteSelectedResult | null {
  if (selectedIds.size === 0) {
    return null
  }

  const index = createGroupIndex(elements)
  const deletedIds = new Set<ElementId>()

  // Deleting a group removes its whole subtree; deleting an individual child
  // leaves the group in place (the scene prunes the dangling reference).
  for (const id of selectedIds) {
    const element = elements.get(id)
    if (!element) {
      continue
    }
    if (element.type === "group") {
      for (const subtreeId of collectSubtreeIds(index, [id])) {
        deletedIds.add(subtreeId)
      }
    } else {
      deletedIds.add(id)
    }
  }

  if (deletedIds.size === 0) {
    return null
  }

  const nextElements = new Map(elements)
  for (const id of deletedIds) {
    nextElements.delete(id)
  }
  // Arrows bound to a deleted target detach before the snapshot is taken, so
  // undo restores a consistent state.
  syncArrowBindings(nextElements)

  return {
    deletedIds,
    elements: nextElements,
    selectedIds: new Set(),
  }
}
