import type { CanvasEngine } from "../engine/engine"
import { getRelativePoint, handlePointerUp } from "./pointer"
import { renderAll } from "./render"
import type { DomState } from "./state"

function handleTouchEnd(
  state: DomState,
  engine: CanvasEngine,
  event: TouchEvent,
) {
  if (event.touches.length < 2) {
    state.pinchStartDistance = null
    state.pinchStartCenter = null
    state.pinchViewportState = null
  }

  if (event.touches.length === 0) {
    const touch = event.changedTouches[0] as unknown as PointerEvent
    const { x, y } = getRelativePoint(state, touch)
    handlePointerUp(state, engine, x, y, touch)
    renderAll(state, engine)
  }
}

export function setupTouchListeners(
  state: DomState,
  engine: CanvasEngine,
): void {
  if (!state.svgElement) {
    return
  }
  state.svgElement.addEventListener("touchstart", (event) => {
    if (event.touches.length < 2) {
      return
    }
    event.preventDefault()
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    state.pinchStartDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY,
    )
    state.pinchStartCenter = {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    }
    state.pinchViewportState = engine.getViewport()
  })

  state.svgElement.addEventListener("touchmove", (event) => {
    if (event.touches.length < 2 || !state.pinchStartDistance) {
      return
    }
    event.preventDefault()
    const touch1 = event.touches[0]
    const touch2 = event.touches[1]
    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY,
    )
    const zoomRatio = distance / state.pinchStartDistance

    const newZoom = Math.max(
      0.1,
      Math.min(10, (state.pinchViewportState?.zoom ?? 1) * zoomRatio),
    )

    // Keep the pinch center stationary in canvas space.
    const rect = state.svgElement?.getBoundingClientRect()
    if (!rect || !state.pinchStartCenter || !state.pinchViewportState) {
      return
    }
    const canvasCenter = {
      x:
        (state.pinchStartCenter.x - rect.left - rect.width / 2) /
          state.pinchViewportState.zoom +
        state.pinchViewportState.x,
      y:
        (state.pinchStartCenter.y - rect.top - rect.height / 2) /
          state.pinchViewportState.zoom +
        state.pinchViewportState.y,
    }
    const newViewport = {
      ...state.pinchViewportState,
      zoom: newZoom,
    }
    const updatedViewport = {
      ...newViewport,
      x:
        canvasCenter.x -
        (canvasCenter.x - newViewport.x) *
          (state.pinchViewportState.zoom / newViewport.zoom),
      y:
        canvasCenter.y -
        (canvasCenter.y - newViewport.y) *
          (state.pinchViewportState.zoom / newViewport.zoom),
    }
    engine.setViewport(updatedViewport)
  })

  state.svgElement.addEventListener("touchend", (event) => {
    handleTouchEnd(state, engine, event)
  })

  state.svgElement.addEventListener("touchcancel", (event) => {
    handleTouchEnd(state, engine, event)
  })
}
