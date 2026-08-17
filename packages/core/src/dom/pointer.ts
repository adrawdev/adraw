import type { CanvasEngine } from "../engine/engine"
import {
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  toCanvasPoint,
} from "../engine/internal"
import type { DomState } from "./state"
import { commitTextEditing, startTextEditing } from "./text-editor"

export function getRelativePoint(
  state: DomState,
  event: MouseEvent | PointerEvent | WheelEvent,
): {
  x: number
  y: number
} {
  if (!state.svgElement) {
    return { x: event.clientX, y: event.clientY }
  }
  const rect = state.svgElement.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

export function handlePointerDown(
  state: DomState,
  engine: CanvasEngine,
  screenX: number,
  screenY: number,
  event: PointerEvent,
): void {
  const point = toCanvasPoint(engine, screenX, screenY)

  // Clicking outside the editor while it's open commits the edit and swallows
  // the click: the next click starts a new gesture.
  if (state.textEditor) {
    commitTextEditing(state, engine)
    return
  }

  // The text tool places a text element and opens the inline editor; the
  // element's text is driven by typing, not by pointer movement.
  if (engine.getActiveTool() === "text") {
    startTextEditing(state, engine, point, event)
    return
  }

  dispatchPointerDown(engine, point, event)
}

export function handlePointerMove(
  state: DomState,
  engine: CanvasEngine,
  screenX: number,
  screenY: number,
  event: PointerEvent,
): void {
  if (state.textEditor) {
    return
  }

  dispatchPointerMove(engine, toCanvasPoint(engine, screenX, screenY), event)
}

export function handlePointerUp(
  state: DomState,
  engine: CanvasEngine,
  screenX: number,
  screenY: number,
  event: PointerEvent,
): void {
  if (state.textEditor) {
    return
  }

  dispatchPointerUp(engine, toCanvasPoint(engine, screenX, screenY), event)
}
