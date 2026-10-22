import { getNextZIndex } from "../../elements"
import type { PathElement, Point, ToolType } from "../../types"
import {
  createBaseToolState,
  getDefaultToolOptions,
  getStyleForContext,
  type Tool,
  type ToolContext,
  type ToolState,
} from "../base"
import { createPathElement, type DrawToolOptions } from "./geometry"

export function createDrawTool(options: DrawToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const defaults = { ...getDefaultToolOptions(), ...options }
  let currentPoints: Point[] = []
  let temporaryElement: PathElement | null = null

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
      currentPoints = []
      temporaryElement = null
    },
    onPointerDown(_context: ToolContext, point: Point, _event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point
      currentPoints = [point]
    },
    onPointerMove(context: ToolContext, point: Point, _event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      state.currentPoint = point
      currentPoints.push(point)

      const element = createPathElement(
        currentPoints,
        getStyleForContext(defaults, context),
      )

      if (element) {
        temporaryElement = element
      }
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (currentPoints.length < 2) {
        state.startPoint = null
        state.currentPoint = null
        currentPoints = []
        temporaryElement = null
        return
      }

      const element = createPathElement(
        currentPoints,
        getStyleForContext(defaults, context),
        {
          zIndex: getNextZIndex(context.getElements().values()),
        },
      )

      if (element) {
        const elements = context.getElements()
        elements.set(element.id, element)
        context.setElements(elements)
        context.setSelectedIds(new Set())
        context.pushHistory()
      }

      state.startPoint = null
      state.currentPoint = null
      currentPoints = []
      temporaryElement = null
    },
    type: "draw" as ToolType,
  }
}

export type { DrawToolOptions } from "./geometry"
