import { STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import { createLine } from "../../elements"
import type { LineElement, Point, ToolType } from "../../types"
import {
  createBaseToolState,
  getDefaultToolOptions,
  type Tool,
  type ToolContext,
  type ToolOptions,
  type ToolState,
} from "../base"

export function createLineTool(options: ToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const toolOptions = { ...getDefaultToolOptions(), ...options }
  let temporaryElement: LineElement | null = null

  return {
    cursor: "crosshair",
    getTemporaryElement() {
      return temporaryElement
    },
    onActivate() {
      state.isActive = true
    },
    onDeactivate() {
      state.isActive = false
      state.startPoint = null
      state.currentPoint = null
      temporaryElement = null
    },
    onPointerDown(_context: ToolContext, point: Point, _event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point
    },
    onPointerMove(context: ToolContext, point: Point, _event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      state.currentPoint = point

      const x = Math.min(state.startPoint.x, point.x)
      const y = Math.min(state.startPoint.y, point.y)
      const width = Math.abs(point.x - state.startPoint.x)
      const height = Math.abs(point.y - state.startPoint.y)

      temporaryElement = createLine({
        endX: point.x,
        endY: point.y,
        height: Math.max(height, 1),
        locked: false,
        rotation: 0,
        startX: state.startPoint.x,
        startY: state.startPoint.y,
        strokeColor:
          context.getStrokeColor() ?? toolOptions.strokeColor ?? STROKE_COLOR,
        strokeWidth: toolOptions.strokeWidth ?? STROKE_WIDTH,
        visible: true,
        width: Math.max(width, 1),
        x,
        y,
        zIndex: 0,
      })
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (!state.startPoint || !state.currentPoint) {
        return
      }

      const dx = state.currentPoint.x - state.startPoint.x
      const dy = state.currentPoint.y - state.startPoint.y

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        const x = Math.min(state.startPoint.x, state.currentPoint.x)
        const y = Math.min(state.startPoint.y, state.currentPoint.y)
        const width = Math.abs(dx)
        const height = Math.abs(dy)

        const element = createLine({
          endX: state.currentPoint.x,
          endY: state.currentPoint.y,
          height: Math.max(height, 1),
          locked: false,
          rotation: 0,
          startX: state.startPoint.x,
          startY: state.startPoint.y,
          strokeColor:
            context.getStrokeColor() ?? toolOptions.strokeColor ?? STROKE_COLOR,
          strokeWidth: toolOptions.strokeWidth ?? STROKE_WIDTH,
          visible: true,
          width: Math.max(width, 1),
          x,
          y,
          zIndex: context.getElements().size,
        })

        const elements = context.getElements()
        elements.set(element.id, element)
        context.setElements(elements)
        context.setSelectedIds(new Set([element.id]))
        context.pushHistory()
        context.setActiveTool("select")
      }

      state.startPoint = null
      state.currentPoint = null
      temporaryElement = null
    },
    type: "line" as ToolType,
  }
}
