import { FILL_COLOR, STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import { createRectangle, getNextZIndex } from "../../elements"
import type {
  CanvasElementStyle,
  Point,
  RectangleElement,
  ToolType,
} from "../../types"
import {
  calculateShapeBounds,
  createBaseToolState,
  finishCreationGesture,
  getDefaultToolOptions,
  getStyleForContext,
  type Tool,
  type ToolContext,
  type ToolState,
} from "../base"
import { snapToolPoint } from "../snap"

export interface RectangleToolOptions extends CanvasElementStyle {
  cornerRadius?: number
}

export function createRectangleTool(options: RectangleToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const defaults = { ...getDefaultToolOptions(), ...options }
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

      const bounds = calculateShapeBounds(state.startPoint, snapped.point, {
        constrainProportions: event.shiftKey,
        fromCenter: event.altKey,
      })

      const currentOptions = getStyleForContext(defaults, context)
      temporaryElement = createRectangle({
        cornerRadius: currentOptions.cornerRadius ?? 0,
        fillColor: currentOptions.fillColor ?? FILL_COLOR,
        height: bounds.height,
        locked: false,
        opacity: currentOptions.opacity ?? 1,
        rotation: 0,
        strokeColor: currentOptions.strokeColor ?? STROKE_COLOR,
        strokeWidth: currentOptions.strokeWidth ?? STROKE_WIDTH,
        visible: true,
        width: bounds.width,
        x: bounds.x,
        y: bounds.y,
        zIndex: 0,
      })
    },
    onPointerUp(context: ToolContext, _point: Point, event: PointerEvent) {
      if (!state.startPoint || !state.currentPoint) {
        return
      }

      const bounds = calculateShapeBounds(
        state.startPoint,
        state.currentPoint,
        {
          constrainProportions: event.shiftKey,
          fromCenter: event.altKey,
        },
      )

      if (bounds.width > 5 && bounds.height > 5) {
        const currentOptions = getStyleForContext(defaults, context)
        const element = createRectangle({
          cornerRadius: currentOptions.cornerRadius ?? 0,
          fillColor: currentOptions.fillColor ?? FILL_COLOR,
          height: bounds.height,
          locked: false,
          opacity: currentOptions.opacity ?? 1,
          rotation: 0,
          strokeColor: currentOptions.strokeColor ?? STROKE_COLOR,
          strokeWidth: currentOptions.strokeWidth ?? STROKE_WIDTH,
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
        finishCreationGesture(context)
      }

      state.startPoint = null
      state.currentPoint = null
      temporaryElement = null
    },
    type: "rectangle" as ToolType,
  }
}
