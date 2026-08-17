import type { Point } from "../../types"
import { type ToolContext } from "../base"
import type { SelectToolState } from "./state"

// Move selected elements by the pointer delta since drag start.
export function moveSelection(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
): void {
  if (!state.dragStartElement || !state.dragStartPoint) {
    return
  }

  const elements = context.getElements()
  const selectedIds = context.getSelectedIds()
  const delta = {
    x: point.x - state.dragStartPoint.x,
    y: point.y - state.dragStartPoint.y,
  }

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
          element.type === "line" &&
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
