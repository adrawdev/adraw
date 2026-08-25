import { STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import { createRectangle, getNextZIndex } from "../../elements"
import type { Point, RectangleElement, ToolType } from "../../types"
import {
  calculateBounds,
  createBaseToolState,
  getDefaultToolOptions,
  type Tool,
  type ToolContext,
  type ToolOptions,
  type ToolState,
} from "../base"

export interface RectangleToolOptions extends ToolOptions {
  cornerRadius?: number
}

export function createRectangleTool(options: RectangleToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const toolOptions = { ...getDefaultToolOptions(), ...options }
  let temporaryElement: RectangleElement | null = null

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

      const bounds = calculateBounds(state.startPoint, point)

      temporaryElement = createRectangle({
        cornerRadius: toolOptions.cornerRadius ?? 0,
        height: bounds.height,
        locked: false,
        rotation: 0,
        strokeColor:
          context.getStrokeColor() ?? toolOptions.strokeColor ?? STROKE_COLOR,
        strokeWidth: toolOptions.strokeWidth ?? STROKE_WIDTH,
        visible: true,
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
        zIndex: 0,
      })
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (!state.startPoint || !state.currentPoint) {
        return
      }

      const bounds = calculateBounds(state.startPoint, state.currentPoint)

      if (bounds.width > 5 && bounds.height > 5) {
        const element = createRectangle({
          cornerRadius: toolOptions.cornerRadius ?? 0,
          height: bounds.height,
          locked: false,
          rotation: 0,
          strokeColor:
            context.getStrokeColor() ?? toolOptions.strokeColor ?? STROKE_COLOR,
          strokeWidth: toolOptions.strokeWidth ?? STROKE_WIDTH,
          visible: true,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
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
    type: "rectangle" as ToolType,
  }
}
