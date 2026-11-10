import { snapBoundsToGrid, snapPointToGrid } from "../grid"
import {
  isSnapActive,
  snapBoundsToElements,
  snapPointToElements,
} from "../snapping"
import type { BoundingBox, ElementId, Point, SnapGuide } from "../types"
import type { ToolContext } from "./base"

export interface SnappedToolPoint {
  guides: SnapGuide[]
  point: Point
}

export interface SnappedToolBounds {
  bounds: BoundingBox
  guides: SnapGuide[]
}

function hasAxisGuide(
  guides: readonly SnapGuide[],
  type: SnapGuide["type"],
): boolean {
  return guides.some((guide) => guide.type === type)
}

// Snap a pointer point to elements while the gesture's modifier (or
// `isSnapMode`) keeps element snapping active, then fill any axis without an
// element guide with the nearest grid intersection. Grid snapping is always
// active while `grid.snap` is on, independent of modifiers. `excludeIds` keeps
// elements being transformed from snapping to themselves.
export function snapToolPoint(
  context: ToolContext,
  point: Point,
  event: PointerEvent,
  excludeIds: Set<ElementId>,
): SnappedToolPoint {
  const grid = context.getGridConfig?.()
  const gridPoint = grid?.snap ? snapPointToGrid(point, grid.size) : null

  if (!isSnapActive(context.getIsSnapMode(), event)) {
    return { guides: [], point: gridPoint ?? point }
  }

  const snapped = snapPointToElements(
    point,
    context.getElements(),
    excludeIds,
    context.getSnappingConfig().threshold,
  )
  if (!gridPoint) {
    return snapped
  }

  return {
    guides: snapped.guides,
    point: {
      x: hasAxisGuide(snapped.guides, "vertical")
        ? snapped.point.x
        : gridPoint.x,
      y: hasAxisGuide(snapped.guides, "horizontal")
        ? snapped.point.y
        : gridPoint.y,
    },
  }
}

// Snap moving bounds to elements while element snapping is active, then fill
// axes without an element guide with the grid. Element guides win per axis;
// grid snapping produces no guides. The bounds keep their size.
export function snapToolBounds(
  context: ToolContext,
  bounds: BoundingBox,
  event: PointerEvent | undefined,
  excludeIds: Set<ElementId>,
): SnappedToolBounds {
  const grid = context.getGridConfig?.()
  const elementSnap =
    event && isSnapActive(context.getIsSnapMode(), event)
      ? snapBoundsToElements(
          bounds,
          context.getElements(),
          excludeIds,
          context.getSnappingConfig().threshold,
        )
      : null
  const guides = elementSnap?.guides ?? []
  let { x, y } = elementSnap ?? bounds

  if (grid?.snap) {
    const gridBounds = snapBoundsToGrid({ ...bounds, x, y }, grid.size)
    if (!hasAxisGuide(guides, "vertical")) {
      x = gridBounds.x
    }
    if (!hasAxisGuide(guides, "horizontal")) {
      y = gridBounds.y
    }
  }

  return { bounds: { ...bounds, x, y }, guides }
}
