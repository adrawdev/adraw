import { screenToCanvas } from "../coordinates"
import type { Point } from "../types"
import { panViewport, zoomViewport } from "../viewport"
import type { EngineInternal } from "./engine"

// ── Screen/pointer dispatch ──

/** @internal */
export function toCanvasPoint(
  engine: EngineInternal,
  screenX: number,
  screenY: number,
): Point {
  return screenToCanvas(
    { x: screenX, y: screenY },
    engine.getViewport(),
    engine.getCanvasSize(),
  )
}

/** @internal */
export function dispatchPointerDown(
  engine: EngineInternal,
  point: Point,
  event: PointerEvent,
): void {
  engine
    .getActiveToolInstance()
    .onPointerDown(engine.getToolContext(), point, event)
}

/** @internal */
export function dispatchPointerMove(
  engine: EngineInternal,
  point: Point,
  event: PointerEvent,
): void {
  engine
    .getActiveToolInstance()
    .onPointerMove(engine.getToolContext(), point, event)
}

/** @internal */
export function dispatchPointerUp(
  engine: EngineInternal,
  point: Point,
  event: PointerEvent,
): void {
  engine
    .getActiveToolInstance()
    .onPointerUp(engine.getToolContext(), point, event)
}

// Screen-coordinate variants used by the facade's headless fallback (no DOM
// adapter mounted): convert, and for pointer-down skip the text tool, whose
// editor path needs a container.
/** @internal */
export function dispatchPointerDownAt(
  engine: EngineInternal,
  screenX: number,
  screenY: number,
  event: PointerEvent,
): void {
  if (engine.getActiveTool() === "text") {
    return
  }
  dispatchPointerDown(engine, toCanvasPoint(engine, screenX, screenY), event)
}

/** @internal */
export function dispatchPointerMoveAt(
  engine: EngineInternal,
  screenX: number,
  screenY: number,
  event: PointerEvent,
): void {
  dispatchPointerMove(engine, toCanvasPoint(engine, screenX, screenY), event)
}

/** @internal */
export function dispatchPointerUpAt(
  engine: EngineInternal,
  screenX: number,
  screenY: number,
  event: PointerEvent,
): void {
  dispatchPointerUp(engine, toCanvasPoint(engine, screenX, screenY), event)
}

// Wheel → zoom/pan, shared by the mounted event handler (which passes the
// pointer relative to the SVG) and the facade's headless fallback (which
// resolves it against `event.currentTarget`, falling back to page coords).
/** @internal */
export function applyWheelTransform(
  engine: EngineInternal,
  event: WheelEvent,
  screenX?: number,
  screenY?: number,
): void {
  event.preventDefault()

  if (event.ctrlKey || event.metaKey) {
    let x = screenX ?? event.clientX
    let y = screenY ?? event.clientY

    if (screenX === undefined || screenY === undefined) {
      const currentTarget = event.currentTarget as HTMLElement | null
      if (currentTarget) {
        const rect = currentTarget.getBoundingClientRect()
        x = event.clientX - rect.left
        y = event.clientY - rect.top
      }
    }

    applyZoomAtScreenPoint(engine, x, y, event.deltaY)
  } else {
    applyPan(engine, event.deltaX, event.deltaY)
  }
}

// Zoom/pan helpers for the adapter's wheel handler (which resolves the
// pointer's screen coordinates against the DOM).
/** @internal */
export function applyZoomAtScreenPoint(
  engine: EngineInternal,
  x: number,
  y: number,
  deltaY: number,
): void {
  const viewport = engine.getViewport()
  const canvasSize = engine.getCanvasSize()
  const centerPoint = {
    x: (canvasSize.width / 2 - x) / viewport.zoom + viewport.x,
    y: (canvasSize.height / 2 - y) / viewport.zoom + viewport.y,
  }
  engine.setViewport(zoomViewport(viewport, deltaY, centerPoint))
}

/** @internal */
export function applyPan(
  engine: EngineInternal,
  deltaX: number,
  deltaY: number,
): void {
  const viewport = engine.getViewport()
  engine.setViewport(
    panViewport(viewport, {
      x: deltaX / viewport.zoom,
      y: deltaY / viewport.zoom,
    }),
  )
}
