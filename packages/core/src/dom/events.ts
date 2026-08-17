import { getElementAtPoint } from "../elements"
import type { CanvasEngine } from "../engine/engine"
import { applyWheelTransform, toCanvasPoint } from "../engine/internal"
import type { ToolType } from "../types"
import {
  getRelativePoint,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
} from "./pointer"
import { renderAll } from "./render"
import type { DomState } from "./state"
import { handleCursorMap } from "./svg"
import { startExistingTextEditing } from "./text-editor"
import { setupTouchListeners } from "./touch"

export function updateCursor(state: DomState, tool: ToolType): void {
  const cursors: Record<ToolType, string> = {
    draw: "crosshair",
    ellipse: "crosshair",
    eraser: "crosshair",
    hand: "grab",
    line: "crosshair",
    rectangle: "crosshair",
    select: "default",
    text: "text",
  }
  if (state.svgElement) {
    state.svgElement.style.cursor = cursors[tool] || "default"
  }
}

export function setupEventListeners(
  state: DomState,
  engine: CanvasEngine,
): void {
  if (!state.svgElement) {
    return
  }

  setupTouchListeners(state, engine)

  state.svgElement.addEventListener("pointerdown", (event) => {
    const { x, y } = getRelativePoint(state, event)
    handlePointerDown(state, engine, x, y, event)
    // Capture the pointer so pointermove/pointerup keep firing while the
    // cursor leaves the container — or the browser window — mid-drag.
    try {
      state.svgElement?.setPointerCapture(event.pointerId)
    } catch {
      // Capture unavailable (e.g. synthetic events in tests) — ignore.
    }
    renderAll(state, engine)
  })

  state.svgElement.addEventListener("pointermove", (event) => {
    const { x, y } = getRelativePoint(state, event)
    handlePointerMove(state, engine, x, y, event)
    renderAll(state, engine)
  })

  state.svgElement.addEventListener("pointerup", (event) => {
    const { x, y } = getRelativePoint(state, event)
    handlePointerUp(state, engine, x, y, event)
    renderAll(state, engine)
  })

  // A cancelled pointer (e.g. the OS takes over the drag) still needs the
  // tool's gesture finalized the same way a pointerup would.
  state.svgElement.addEventListener("pointercancel", (event) => {
    const { x, y } = getRelativePoint(state, event)
    handlePointerUp(state, engine, x, y, event)
    renderAll(state, engine)
  })

  // Double-clicking a text element opens the inline editor for it.
  state.svgElement.addEventListener("dblclick", (event) => {
    if (state.textEditor || engine.getActiveTool() !== "select") {
      return
    }
    const { x, y } = getRelativePoint(state, event)
    const point = toCanvasPoint(engine, x, y)
    const element = getElementAtPoint(engine.getElements(), point)
    if (element?.type === "text") {
      startExistingTextEditing(state, engine, element)
    }
  })

  // Set cursor based on hovered handle. Skipped mid-drag: with pointer capture,
  // moves outside the container retarget to the svg (no anchor), and resetting
  // the cursor would fight the drag cursor.
  state.svgElement.addEventListener("pointermove", (event) => {
    if (event.buttons > 0 || !state.svgElement) {
      return
    }
    const target = event.target as HTMLElement
    const anchor = target.getAttribute("data-anchor")
    if (anchor && handleCursorMap[anchor]) {
      state.svgElement.style.cursor = handleCursorMap[anchor]
    } else if (!state.svgElement.style.cursor.startsWith("grab")) {
      state.svgElement.style.cursor = "default"
    }
  })

  state.svgElement.addEventListener(
    "wheel",
    (event) => {
      const { x, y } = getRelativePoint(state, event)
      applyWheelTransform(engine, event, x, y)
      renderAll(state, engine)
    },
    { passive: false },
  )

  document.addEventListener("keydown", (event) => {
    engine.handleKeyDown(event)
    renderAll(state, engine)
  })
}
