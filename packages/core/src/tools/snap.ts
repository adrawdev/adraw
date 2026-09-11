import { isSnapActive, snapPointToElements } from "../snapping"
import type { ElementId, Point, SnapGuide } from "../types"
import type { ToolContext } from "./base"

export interface SnappedToolPoint {
  guides: SnapGuide[]
  point: Point
}

// Snap a pointer point to other elements while the gesture's modifier (or
// `isSnapMode`) keeps snapping active; otherwise the point passes through
// unchanged. `excludeIds` keeps elements being transformed from snapping to
// themselves.
export function snapToolPoint(
  context: ToolContext,
  point: Point,
  event: PointerEvent,
  excludeIds: Set<ElementId>,
): SnappedToolPoint {
  if (!isSnapActive(context.getIsSnapMode(), event)) {
    return { guides: [], point }
  }

  return snapPointToElements(
    point,
    context.getElements(),
    excludeIds,
    context.getSnappingConfig().threshold,
  )
}
