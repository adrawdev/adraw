import { detachArrowsOutsideSelection } from "../../bindings"
import { isSnapActive, snapBoundsToElements } from "../../snapping"
import type { Point, SnapGuide } from "../../types"
import { type ToolContext } from "../base"
import type { SelectToolState } from "./state"

// Move selected elements by the pointer delta since drag start, optionally
// snapping the moved selection bounds to other elements' edges/centers.
export function moveSelection(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
  event?: PointerEvent,
): void {
  if (!state.dragStartElement || !state.dragStartPoint) {
    return
  }

  const elements = context.getElements()
  const selectedIds = context.getSelectedIds()
  // A direct move detaches arrows from targets outside the moving selection;
  // arrows whose targets move along stay bound.
  detachArrowsOutsideSelection(elements, selectedIds)
  let delta = {
    x: point.x - state.dragStartPoint.x,
    y: point.y - state.dragStartPoint.y,
  }
  let guides: SnapGuide[] = []

  const bounds = state.originalBounds
  if (event && bounds && isSnapActive(context.getIsSnapMode(), event)) {
    const snapped = snapBoundsToElements(
      {
        height: bounds.height,
        width: bounds.width,
        x: bounds.x + delta.x,
        y: bounds.y + delta.y,
      },
      elements,
      selectedIds,
      context.getSnappingConfig().threshold,
    )
    delta = { x: snapped.x - bounds.x, y: snapped.y - bounds.y }
    guides = snapped.guides
  }
  context.setSnapGuides(guides)

  for (const id of selectedIds) {
    const original = state.originalPositions.get(id)
    if (original) {
      const element = elements.get(id)
      if (element) {
        if (element.type === "path" && original.points) {
          // Paths render from absolute points, so move them alongside the
          // bounding box rather than relying on a separate DOM-layer shift.
          elements.set(id, {
            ...element,
            points: original.points.map((p) => ({
              x: p.x + delta.x,
              y: p.y + delta.y,
            })),
            x: original.x + delta.x,
            y: original.y + delta.y,
          })
        } else if (
          (element.type === "line" || element.type === "arrow") &&
          original.lineStart &&
          original.lineEnd
        ) {
          // Lines also render from absolute start/end coordinates.
          elements.set(id, {
            ...element,
            endX: original.lineEnd.x + delta.x,
            endY: original.lineEnd.y + delta.y,
            startX: original.lineStart.x + delta.x,
            startY: original.lineStart.y + delta.y,
            x: original.x + delta.x,
            y: original.y + delta.y,
          })
        } else {
          elements.set(id, {
            ...element,
            x: original.x + delta.x,
            y: original.y + delta.y,
          })
        }
      }
    }
  }

  context.setElements(new Map(elements))
}
