import { getElementAtPoint } from "../../elements"
import type { Point, ToolType } from "../../types"
import {
  createBaseToolState,
  type Tool,
  type ToolContext,
  type ToolState,
} from "../base"

export function createEraserTool(): Tool {
  const state: ToolState = createBaseToolState()
  let deletedElements: string[] = []

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
      deletedElements = []
    },
    onPointerDown(context: ToolContext, point: Point, _event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point
      deletedElements = []

      const element = getElementAtPoint(context.getElements(), point)

      if (element) {
        const elements = context.getElements()
        elements.delete(element.id)
        context.setElements(elements)
        deletedElements.push(element.id)
      }
    },
    onPointerMove(context: ToolContext, point: Point, _event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      state.currentPoint = point

      const element = getElementAtPoint(context.getElements(), point)

      if (element && !deletedElements.includes(element.id)) {
        const elements = context.getElements()
        elements.delete(element.id)
        context.setElements(elements)
        deletedElements.push(element.id)
      }
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (deletedElements.length > 0) {
        context.pushHistory()
      }

      state.startPoint = null
      state.currentPoint = null
      deletedElements = []
    },
    type: "eraser" as ToolType,
  }
}
