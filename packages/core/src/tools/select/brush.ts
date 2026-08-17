import type { Point } from "../../types"
import { calculateBounds, type ToolContext } from "../base"
import { boxesIntersect, type SelectToolState } from "./state"

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
  const next = new Set(state.brushBaseSelection)
  for (const el of context.getElements().values()) {
    if (el.visible && !el.locked && boxesIntersect(state.brushBox, el)) {
      next.add(el.id)
    }
  }
  context.setSelectedIds(next)
}
