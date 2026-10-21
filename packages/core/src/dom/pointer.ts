import type { CanvasEngine } from "../engine/engine"
import {
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  reactivateActiveTool,
  toCanvasPoint,
} from "../engine/internal"
import { isBoundTextContainer, findBoundText } from "../text-bindings"
import type { TextTool } from "../tools"
import type { DomState } from "./state"
import { commitTextEditing, startExistingTextEditing } from "./text-editor"
import {
  resolveTextTarget,
  startBoundTextEditing,
  startFreeTextEditing,
} from "./text-target"

const TEXT_DRAG_THRESHOLD = 6
const TEXT_MIN_DRAG_WIDTH = 16

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

// Drop a pending text press (tool switch, pointer cancel or a new gesture) and
// discard the fixed-width preview it may have created.
export function cancelTextGesture(state: DomState, engine: CanvasEngine): void {
  const gesture = state.textGesture
  if (!gesture) {
    return
  }
  state.textGesture = null
  if (gesture.dragging && engine.getActiveTool() === "text") {
    reactivateActiveTool(engine)
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

  cancelTextGesture(state, engine)

  // The text tool resolves the click first: existing text is edited, a shape
  // near its center gets a label, and anything else arms a free-text press.
  // The editor opens on pointer-up so a horizontal drag can create a
  // fixed-width text instead.
  if (engine.getActiveTool() === "text") {
    const target = resolveTextTarget(
      engine.getElements(),
      point,
      engine.getViewport().zoom,
    )
    if (target.kind === "text") {
      startExistingTextEditing(state, engine, target.element)
      return
    }

    if (target.kind === "bound") {
      const existing = findBoundText(engine.getElements(), target.container.id)
      if (existing) {
        startExistingTextEditing(state, engine, existing)
        return
      }
      state.textGesture = {
        containerId: target.container.id,
        dragging: false,
        event,
        pointerId: event.pointerId,
        start: point,
        startScreen: { x: screenX, y: screenY },
      }
      return
    }

    state.textGesture = {
      containerId: null,
      dragging: false,
      event,
      pointerId: event.pointerId,
      start: point,
      startScreen: { x: screenX, y: screenY },
    }
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

  const gesture = state.textGesture
  if (gesture) {
    if (engine.getActiveTool() !== "text") {
      cancelTextGesture(state, engine)
      return
    }

    const point = toCanvasPoint(engine, screenX, screenY)
    if (!gesture.dragging) {
      const dx = screenX - gesture.startScreen.x
      if (Math.abs(dx) <= TEXT_DRAG_THRESHOLD) {
        return
      }
      // A drag turns the press into free text: a label armed inside a shape is
      // abandoned in favour of a fixed-width text at the origin.
      gesture.dragging = true
      gesture.containerId = null
      dispatchPointerDown(engine, gesture.start, gesture.event)
    }

    const zoom = engine.getViewport().zoom
    const width = Math.max(
      TEXT_MIN_DRAG_WIDTH / Math.max(zoom, 0.01),
      Math.abs(point.x - gesture.start.x),
    )
    const x = Math.min(gesture.start.x, point.x)
    const tool = engine.getActiveToolInstance()
    if (tool.type === "text") {
      ;(tool as TextTool).setFixedWidth(width, x)
    }
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

  const gesture = state.textGesture
  if (gesture) {
    state.textGesture = null

    if (event.type === "pointercancel") {
      if (gesture.dragging && engine.getActiveTool() === "text") {
        reactivateActiveTool(engine)
      }
      return
    }

    const point = toCanvasPoint(engine, screenX, screenY)
    if (gesture.dragging) {
      const temporary = engine.getTemporaryElement()
      const id = temporary?.type === "text" ? temporary.id : null
      // Commits the empty fixed-width element and switches back to select.
      dispatchPointerUp(engine, point, event)
      if (id) {
        const element = engine.getElements().get(id)
        if (element?.type === "text") {
          startExistingTextEditing(state, engine, element)
        }
      }
      return
    }

    if (gesture.containerId) {
      const container = engine.getElements().get(gesture.containerId)
      if (isBoundTextContainer(container)) {
        startBoundTextEditing(state, engine, container)
        return
      }
    }

    startFreeTextEditing(state, engine, gesture.start)
    return
  }

  dispatchPointerUp(engine, toCanvasPoint(engine, screenX, screenY), event)
}
