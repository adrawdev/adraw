import { STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import { createLine, getNextZIndex } from "../../elements"
import type { LineElement, Point, ToolType } from "../../types"
import {
  createBaseToolState,
  getDefaultToolOptions,
  type Tool,
  type ToolContext,
  type ToolOptions,
  type ToolState,
} from "../base"
import { snapToolPoint } from "../snap"

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
    onPointerDown(context: ToolContext, point: Point, event: PointerEvent) {
      const snapped = snapToolPoint(context, point, event, new Set())
      state.startPoint = snapped.point
      state.currentPoint = snapped.point
      context.setSnapGuides(snapped.guides)
    },
    onPointerMove(context: ToolContext, point: Point, event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      const snapped = snapToolPoint(context, point, event, new Set())
      state.currentPoint = snapped.point
      context.setSnapGuides(snapped.guides)

      const x = Math.min(state.startPoint.x, snapped.point.x)
      const y = Math.min(state.startPoint.y, snapped.point.y)
      const width = Math.abs(snapped.point.x - state.startPoint.x)
      const height = Math.abs(snapped.point.y - state.startPoint.y)

      temporaryElement = createLine({
        endX: snapped.point.x,
        endY: snapped.point.y,
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
          zIndex: getNextZIndex(context.getElements().values()),
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
