import {
  BINDING_PICK_MARGIN,
  findBindingTarget,
  resolveArrowElement,
} from "../../bindings"
import { STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import { createArrow, getNextZIndex } from "../../elements"
import type { ArrowBinding, ArrowElement, ElementId, Point } from "../../types"
import {
  createBaseToolState,
  getDefaultToolOptions,
  type Tool,
  type ToolContext,
  type ToolOptions,
  type ToolState,
} from "../base"
import { snapToolPoint } from "../snap"

export function createArrowTool(options: ToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const toolOptions = { ...getDefaultToolOptions(), ...options }
  let temporaryElement: ArrowElement | null = null
  let startBinding: ArrowBinding | null = null
  let bindingCandidate: ElementId | null = null

  const getMargin = (context: ToolContext) =>
    BINDING_PICK_MARGIN / Math.max(context.getViewport().zoom, 0.01)

  const buildArrow = (
    context: ToolContext,
    start: Point,
    end: Point,
    startLink: ArrowBinding | null,
    endLink: ArrowBinding | null,
  ): ArrowElement => {
    const element = createArrow({
      endArrowhead: true,
      endBinding: endLink,
      endX: end.x,
      endY: end.y,
      height: Math.max(Math.abs(end.y - start.y), 1),
      locked: false,
      rotation: 0,
      startBinding: startLink,
      startX: start.x,
      startY: start.y,
      strokeColor:
        context.getStrokeColor() ?? toolOptions.strokeColor ?? STROKE_COLOR,
      strokeWidth: toolOptions.strokeWidth ?? STROKE_WIDTH,
      visible: true,
      width: Math.max(Math.abs(end.x - start.x), 1),
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      zIndex: 0,
    })
    return resolveArrowElement(element, context.getElements())
  }

  return {
    cursor: "crosshair",
    getBindingCandidate() {
      return bindingCandidate
    },
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
      startBinding = null
      bindingCandidate = null
    },
    onPointerDown(context: ToolContext, point: Point, event: PointerEvent) {
      const snapped = snapToolPoint(context, point, event, new Set())
      state.startPoint = snapped.point
      state.currentPoint = snapped.point

      const startTarget = findBindingTarget(
        context.getElements(),
        snapped.point,
        getMargin(context),
      )
      startBinding = startTarget ? { elementId: startTarget.id } : null
      bindingCandidate = startTarget?.id ?? null
      context.setSnapGuides(snapped.guides)
    },
    onPointerMove(context: ToolContext, point: Point, event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      const snapped = snapToolPoint(context, point, event, new Set())
      state.currentPoint = snapped.point
      context.setSnapGuides(snapped.guides)

      const endTarget = findBindingTarget(
        context.getElements(),
        snapped.point,
        getMargin(context),
      )
      const endBinding = endTarget ? { elementId: endTarget.id } : null
      bindingCandidate =
        endTarget?.id ?? (startBinding ? startBinding.elementId : null)

      temporaryElement = buildArrow(
        context,
        state.startPoint,
        snapped.point,
        startBinding,
        endBinding,
      )
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (!state.startPoint || !state.currentPoint) {
        return
      }

      const dx = state.currentPoint.x - state.startPoint.x
      const dy = state.currentPoint.y - state.startPoint.y

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        const endTarget = findBindingTarget(
          context.getElements(),
          state.currentPoint,
          getMargin(context),
        )
        const element = buildArrow(
          context,
          state.startPoint,
          state.currentPoint,
          startBinding,
          endTarget ? { elementId: endTarget.id } : null,
        )
        const elements = context.getElements()
        elements.set(element.id, {
          ...element,
          zIndex: getNextZIndex(elements.values()),
        })
        context.setElements(elements)
        context.setSelectedIds(new Set([element.id]))
        context.pushHistory()
        context.setActiveTool("select")
      }

      state.startPoint = null
      state.currentPoint = null
      temporaryElement = null
      startBinding = null
      bindingCandidate = null
    },
    type: "arrow",
  }
}
