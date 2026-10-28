import {
  createGroupIndex,
  getSelectableChildren,
  type GroupIndex,
} from "../../groups"
import type { BoundingBox, ElementId, Point } from "../../types"
import { calculateBounds, type ToolContext } from "../base"
import { boxesIntersect, type SelectToolState } from "./state"

// A group is selected when the marquee touches one of its visible,
// unlocked descendants, not merely its union bounding box.
function elementIntersects(
  index: GroupIndex,
  id: ElementId,
  box: BoundingBox,
): boolean {
  const element = index.elements.get(id)
  if (!element || !element.visible || element.locked) {
    return false
  }
  if (element.type !== "group") {
    return boxesIntersect(box, element)
  }
  return element.children.some((childId) =>
    elementIntersects(index, childId, box),
  )
}

// Grow the marquee and reselect every element it now touches, unioned with the
// selection captured at brush start (empty unless the multi-select modifier
// was held).
export function updateBrushSelection(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
): void {
  if (!state.brushStart) {
    return
  }

  state.brushBox = calculateBounds(state.brushStart, point)
  const elements = context.getElements()
  const index = createGroupIndex(elements)
  const next = new Set(state.brushBaseSelection)

  for (const id of getSelectableChildren(index, state.contextId)) {
    const element = elements.get(id)
    if (!element) {
      continue
    }
    // Bound labels move with their container; selecting them directly would
    // let a drag detach them from the shape.
    if (element.type === "text" && element.containerId) {
      continue
    }
    if (elementIntersects(index, id, state.brushBox)) {
      next.add(id)
    }
  }
  context.setSelectedIds(next)
}
