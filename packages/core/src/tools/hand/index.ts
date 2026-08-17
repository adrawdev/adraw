import type { Point, ToolType } from "../../types"
import { panViewport } from "../../viewport"
import {
  createBaseToolState,
  type Tool,
  type ToolContext,
  type ToolState,
} from "../base"

export function createHandTool(): Tool {
  const state: ToolState = createBaseToolState()
  let lastPoint: Point | null = null

  return {
    cursor: "grab",
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
      lastPoint = null
    },
    onPointerDown(_context: ToolContext, point: Point, event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point
      lastPoint = { x: event.clientX, y: event.clientY }
    },
    onPointerMove(context: ToolContext, point: Point, event: PointerEvent) {
      if (lastPoint === null || !state.isActive) {
        return
      }

      // Derive movement from the client-position delta so the pan tracks the
      // pointer exactly. `event.movementX/Y` is unreliable across browsers, and
      // gating on both axes being non-zero would drop any purely horizontal or
      // vertical drag.
      const movementX = event.clientX - lastPoint.x
      const movementY = event.clientY - lastPoint.y

      if (movementX === 0 && movementY === 0) {
        return
      }

      const viewport = context.getViewport()
      const delta = {
        x: -movementX / viewport.zoom,
        y: -movementY / viewport.zoom,
      }

      const newViewport = panViewport(viewport, delta)

      context.setViewport(newViewport)
      state.currentPoint = point
      lastPoint = { x: event.clientX, y: event.clientY }
    },
    onPointerUp(_context: ToolContext, _point: Point, _event: PointerEvent) {
      state.startPoint = null
      state.currentPoint = null
      lastPoint = null
    },
    type: "hand" as ToolType,
  }
}
