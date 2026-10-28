import { getElementAtPoint } from "../elements"
import type { CanvasEngine } from "../engine/engine"
import { applyWheelTransform, toCanvasPoint } from "../engine/internal"
import { runStateOperation } from "../engine/state-notifier"
import {
  createGroupIndex,
  getDirectChildId,
  getTopLevelId,
  resolveSelectionTargetId,
} from "../groups"
import { isBoundTextContainer } from "../text-bindings"
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
import { startBoundTextEditing, startFreeTextEditing } from "./text-target"
import { setupTouchListeners } from "./touch"

export function updateCursor(state: DomState, tool: ToolType): void {
  const cursors: Record<ToolType, string> = {
    arrow: "crosshair",
    diamond: "crosshair",
    draw: "crosshair",
    ellipse: "crosshair",
    eraser: "crosshair",
    hand: "grab",
    line: "crosshair",
    note: "crosshair",
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
): () => void {
  if (!state.svgElement) {
    return () => {}
  }

  const svgElement = state.svgElement
  const keyboardScope = engine.getKeyboardScope()

  // Firefox can start a native drag-and-drop from an SVG child (e.g. a shape
  // being dragged with the select tool). That fires `pointercancel` and kills
  // the gesture mid-move, so native dragging is never allowed on the canvas.
  const preventNativeDrag = (event: DragEvent): void => {
    event.preventDefault()
  }
  svgElement.addEventListener("dragstart", preventNativeDrag)
  const removeNativeDragGuard = (): void => {
    svgElement.removeEventListener("dragstart", preventNativeDrag)
  }

  setupTouchListeners(state, engine)

  if (keyboardScope === "canvas") {
    svgElement.tabIndex = 0
  }

  svgElement.addEventListener("pointerdown", (event) => {
    runStateOperation(engine, () => {
      const { x, y } = getRelativePoint(state, event)
      handlePointerDown(state, engine, x, y, event)
      // Capture the pointer so pointermove/pointerup keep firing while the
      // cursor leaves the container — or the browser window — mid-drag.
      try {
        svgElement.setPointerCapture(event.pointerId)
      } catch {
        // Capture unavailable (e.g. synthetic events in tests) — ignore.
      }
      if (keyboardScope === "canvas") {
        svgElement.focus({ preventScroll: true })
      }
      renderAll(state, engine)
    })
  })

  state.svgElement.addEventListener("pointermove", (event) => {
    runStateOperation(engine, () => {
      const { x, y } = getRelativePoint(state, event)
      handlePointerMove(state, engine, x, y, event)
      renderAll(state, engine)
    })
  })

  state.svgElement.addEventListener("pointerup", (event) => {
    runStateOperation(engine, () => {
      const { x, y } = getRelativePoint(state, event)
      handlePointerUp(state, engine, x, y, event)
      renderAll(state, engine)
    })
  })

  // A cancelled pointer (e.g. the OS takes over the drag) still needs the
  // tool's gesture finalized the same way a pointerup would.
  state.svgElement.addEventListener("pointercancel", (event) => {
    runStateOperation(engine, () => {
      const { x, y } = getRelativePoint(state, event)
      handlePointerUp(state, engine, x, y, event)
      renderAll(state, engine)
    })
  })

  // Double-click resolves the target at the current drill level. A group is
  // entered; any other target keeps the existing text/note editor, container
  // label or free-text behavior. On empty canvas it creates free text.
  state.svgElement.addEventListener("dblclick", (event) => {
    runStateOperation(engine, () => {
      if (state.textEditor || engine.getActiveTool() !== "select") {
        return
      }
      const { x, y } = getRelativePoint(state, event)
      const point = toCanvasPoint(engine, x, y)

      const elements = engine.getElements()
      const index = createGroupIndex(elements)
      const contextId = engine.getGroupContext()
      let hit = getElementAtPoint(elements, point)
      // Clicking a bound label resolves to its container, like a single click.
      if (hit?.type === "text" && hit.containerId) {
        hit = elements.get(hit.containerId) ?? hit
      }

      if (!hit) {
        if (contextId) {
          engine.setGroupContext(null)
        }
        startFreeTextEditing(state, engine, point)
        return
      }

      const targetId = resolveSelectionTargetId(index, hit.id, contextId)
      let target = targetId ? elements.get(targetId) : null
      if (!target) {
        // The hit is outside the entered group: leave it and act on the
        // top-level object under the pointer.
        engine.setGroupContext(null)
        target = elements.get(getTopLevelId(index, hit.id)) ?? hit
      }

      if (target.type === "group") {
        const childId = getDirectChildId(index, target.id, hit.id) ?? target.id
        engine.setGroupContext(target.id)
        engine.setSelectedIds(new Set([childId]))
        return
      }

      if (target.type === "text" || target.type === "note") {
        startExistingTextEditing(state, engine, target)
        return
      }
      if (isBoundTextContainer(target)) {
        startBoundTextEditing(state, engine, target)
        return
      }
      startFreeTextEditing(state, engine, point)
    })
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
    } else if (
      engine.getActiveTool() === "select" &&
      !state.svgElement.style.cursor.startsWith("grab")
    ) {
      const { x, y } = getRelativePoint(state, event)
      const hovered = getElementAtPoint(
        engine.getElements(),
        toCanvasPoint(engine, x, y),
      )
      state.svgElement.style.cursor =
        hovered?.type === "text" || hovered?.type === "note"
          ? "text"
          : "default"
    } else if (!state.svgElement.style.cursor.startsWith("grab")) {
      state.svgElement.style.cursor = "default"
    }
  })

  state.svgElement.addEventListener(
    "wheel",
    (event) => {
      runStateOperation(engine, () => {
        const { x, y } = getRelativePoint(state, event)
        applyWheelTransform(engine, event, x, y)
        renderAll(state, engine)
      })
    },
    { passive: false },
  )

  const handleKeyDown = (event: KeyboardEvent): void => {
    runStateOperation(engine, () => {
      const target = event.target
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      // Enter / F2 on a selected text element opens the inline editor, matching
      // Excalidraw and tldraw.
      if (
        !isEditable &&
        !state.textEditor &&
        engine.getActiveTool() === "select" &&
        (event.key === "Enter" || event.key === "F2")
      ) {
        const selectedIds = engine.getSelectedIds()
        if (selectedIds.size === 1) {
          const [id] = selectedIds
          const element = engine.getElements().get(id)
          if (
            (element?.type === "text" || element?.type === "note") &&
            !element.locked
          ) {
            event.preventDefault()
            startExistingTextEditing(state, engine, element)
            return
          }
        }
      }

      engine.handleKeyDown(event)
      renderAll(state, engine)
    })
  }

  if (keyboardScope === "document") {
    const doc = svgElement.ownerDocument
    doc.addEventListener("keydown", handleKeyDown)
    return () => {
      removeNativeDragGuard()
      doc.removeEventListener("keydown", handleKeyDown)
    }
  }

  if (keyboardScope === "canvas") {
    svgElement.addEventListener("keydown", handleKeyDown)
    return () => {
      removeNativeDragGuard()
      svgElement.removeEventListener("keydown", handleKeyDown)
    }
  }

  return removeNativeDragGuard
}
