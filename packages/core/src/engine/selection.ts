import { pushHistory, type HistoryState } from "../history"
import type { CanvasElement, ElementId, ViewportState } from "../types"

export function selectAllIds(
  elements: Map<ElementId, CanvasElement>,
): Set<ElementId> {
  return new Set(elements.keys())
}

export function deleteSelectedElements(
  elements: Map<ElementId, CanvasElement>,
  selectedIds: Set<ElementId>,
  history: HistoryState,
): {
  elements: Map<ElementId, CanvasElement>
  history: HistoryState
  selectedIds: Set<ElementId>
} | null {
  if (selectedIds.size === 0) {
    return null
  }

  const nextElements = new Map(elements)
  for (const id of selectedIds) {
    nextElements.delete(id)
  }

  return {
    elements: nextElements,
    history: pushHistory(history, nextElements, selectedIds),
    selectedIds: new Set(),
  }
}

// Fit the viewport over `bounds` with 100px padding, clamped to zoom 0.1–10.
// Returns null when the content has no area (cannot be fitted).
export function computeZoomToFitViewport(
  bounds: { bottom: number; left: number; right: number; top: number },
  canvasSize: { height: number; width: number },
): ViewportState | null {
  const contentWidth = bounds.right - bounds.left
  const contentHeight = bounds.bottom - bounds.top

  if (contentWidth === 0 || contentHeight === 0) {
    return null
  }

  const availableWidth = canvasSize.width - 100
  const availableHeight = canvasSize.height - 100

  const scaleX = availableWidth / contentWidth
  const scaleY = availableHeight / contentHeight
  const newZoom = Math.min(scaleX, scaleY, 10)

  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    zoom: Math.max(0.1, newZoom),
  }
}
