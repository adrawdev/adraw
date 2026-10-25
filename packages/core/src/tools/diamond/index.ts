import { FILL_COLOR, STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import { createDiamond, getNextZIndex } from "../../elements"
import type {
  CanvasElementStyle,
  DiamondElement,
  Point,
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

/**
 * Style options accepted by {@link createDiamondTool}. The diamond inherits
 * the global style unless an option is provided here.
 */
export type DiamondToolOptions = CanvasElementStyle

/**
 * Create the diamond tool. Dragging lays out the diamond's bounding box; the
 * shape fills that box with vertices at the midpoints of its edges.
 *
 * @param options Initial style overrides.
 * @returns A tool that creates diamond elements.
 * @example
 * ```ts
 * const diamond = createDiamondTool({ strokeColor: "#228be6" })
 * ```
 */
export function createDiamondTool(options: DiamondToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const defaults = { ...getDefaultToolOptions(), ...options }
  let temporaryElement: DiamondElement | null = null

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
      temporaryElement = createDiamond({
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
        const element = createDiamond({
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
    type: "diamond" as ToolType,
  }
}
