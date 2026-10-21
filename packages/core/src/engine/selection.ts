import { syncArrowBindings } from "../bindings"
import type { CanvasElement, ElementId } from "../types"

export function selectAllIds(
  elements: Map<ElementId, CanvasElement>,
): Set<ElementId> {
  return new Set(elements.keys())
}

export function deleteSelectedElements(
  elements: Map<ElementId, CanvasElement>,
  selectedIds: Set<ElementId>,
): {
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
} | null {
  if (selectedIds.size === 0) {
    return null
  }

  const nextElements = new Map(elements)
  for (const id of selectedIds) {
    nextElements.delete(id)
  }
  // Arrows bound to a deleted target detach before the snapshot is taken, so
  // undo restores a consistent state.
  syncArrowBindings(nextElements)

  return {
    elements: nextElements,
    selectedIds: new Set(),
  }
}
