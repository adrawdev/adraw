import { getElementAtPoint } from "../../elements"
import {
  collectSubtreeIds,
  createGroupIndex,
  getContextChain,
  getTopLevelId,
  resolveContextChain,
} from "../../groups"
import type { ElementId, Point, ToolType } from "../../types"
import {
  createBaseToolState,
  type Tool,
  type ToolContext,
  type ToolState,
} from "../base"

export function createEraserTool(): Tool {
  const state: ToolState = createBaseToolState()
  let deletedIds = new Set<ElementId>()

  const eraseAt = (context: ToolContext, point: Point): void => {
    const elements = context.getElements()
    const hit = getElementAtPoint(elements, point)
    if (!hit) {
      return
    }

    const index = createGroupIndex(elements)
    // The eraser always removes the outermost group that owns the hit, even
    // when the pointer is over a nested child.
    const topId = getTopLevelId(index, hit.id)
    if (deletedIds.has(topId)) {
      return
    }
    const topElement = elements.get(topId)
    if (!topElement) {
      return
    }

    const removed =
      topElement.type === "group"
        ? collectSubtreeIds(index, [topId])
        : new Set([topId])
    const next = new Map(elements)
    for (const id of removed) {
      next.delete(id)
    }

    // If the entered group was inside the erased subtree, fall back to the
    // nearest surviving ancestor before publishing the new elements.
    const contextChain = getContextChain(
      index,
      context.getGroupContext?.() ?? null,
    )
    context.setGroupContext?.(resolveContextChain(next, contextChain))
    context.setElements(next)

    for (const id of removed) {
      deletedIds.add(id)
    }
  }

  return {
    cursor: "crosshair",
    getTemporaryElement() {
      return null
    },
    onActivate() {
      state.isActive = true
    },
    onDeactivate() {
      state.isActive = false
      state.startPoint = null
      state.currentPoint = null
      deletedIds = new Set()
    },
    onPointerDown(context: ToolContext, point: Point, _event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point
      deletedIds = new Set()
      eraseAt(context, point)
    },
    onPointerMove(context: ToolContext, point: Point, _event: PointerEvent) {
      if (!state.startPoint) {
        return
      }
      state.currentPoint = point
      eraseAt(context, point)
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (deletedIds.size > 0) {
        context.pushHistory()
      }

      state.startPoint = null
      state.currentPoint = null
      deletedIds = new Set()
    },
    type: "eraser" as ToolType,
  }
}
