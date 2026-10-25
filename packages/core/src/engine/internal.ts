import { measureNoteText } from "../note"
import type { TextTool } from "../tools"
import type { BoundingBox, EditableTextElement, ElementId } from "../types"
import type { CanvasEngine } from "./engine"

export {
  applyPan,
  applyWheelTransform,
  applyZoomAtScreenPoint,
  dispatchPointerDown,
  dispatchPointerDownAt,
  dispatchPointerMove,
  dispatchPointerMoveAt,
  dispatchPointerUp,
  dispatchPointerUpAt,
  toCanvasPoint,
} from "./pointer"

// The internal surface a `CanvasEngine` exposes to its DOM-adapter hooks (see
// the functions below). Everything here is `/** @internal */` on the engine —
// not part of the public API.
// ── Inline text-editing integration (used by the DOM adapter's editor) ──

// Push the editor's current text into the text tool's temporary element.
/** @internal */
export function setActiveToolText(engine: CanvasEngine, text: string): void {
  const tool = engine.getActiveToolInstance()
  if (tool.type === "text") {
    ;(tool as TextTool).setText(text)
  }
}

// Reset the active tool so its temporary element disappears (used when
// cancelling a brand-new text edit).
/** @internal */
export function reactivateActiveTool(engine: CanvasEngine): void {
  const tool = engine.getActiveToolInstance()
  const context = engine.getToolContext()
  tool.onDeactivate(context)
  tool.onActivate(context)
}

// Live-update a committed text or note element while the editor is open.
/** @internal */
export function updateTextElement(
  engine: CanvasEngine,
  id: ElementId,
  text: string,
): void {
  const element = engine.getElements().get(id)
  if (!element || (element.type !== "text" && element.type !== "note")) {
    return
  }

  let next: EditableTextElement
  if (element.type === "note") {
    const layout = measureNoteText(
      { ...element, text },
      engine.getTextMeasurer(),
    )
    next = {
      ...element,
      height: Math.max(element.height, layout.height + element.padding * 2),
      text,
    }
  } else {
    const layout = engine.measureText(text, {
      autoSize: element.autoSize,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      lineHeight: element.lineHeight,
      maxWidth: element.wrapWidth ?? element.width,
      shrinkWidth:
        element.containerId !== null && element.containerId !== undefined,
    })
    next = {
      ...element,
      height: layout.height,
      text,
      width: layout.width,
    }
  }

  engine.commitScene((draft) => {
    draft.elements.set(id, next)
  })
}

// Commit an edited text element: empty text deletes it (and drops it from the
// selection); otherwise the edits are kept. Pushes history unless recording is
// suppressed by `withoutHistory`.
/** @internal */
export function commitTextEdit(engine: CanvasEngine, id: ElementId): void {
  const element = engine.getElements().get(id)
  if (!element || (element.type !== "text" && element.type !== "note")) {
    return
  }
  if (element.type === "text" && element.text.trim() === "") {
    // Deleting all text removes the element. Notes stay, even when empty.
    engine.commitScene((draft) => {
      draft.elements.delete(id)
      draft.selectedIds.delete(id)
    })
  }
  engine.pushHistory()
}

// Restore the pre-edit snapshot of a text element (on cancel).
/** @internal */
export function restoreTextElement(
  engine: CanvasEngine,
  id: ElementId,
  original: EditableTextElement,
): void {
  engine.commitScene((draft) => {
    draft.elements.set(id, original)
  })
}

// ── Transform-overlay queries (used by the DOM adapter's renderer) ──

/** @internal */
export function getSelectionBox(engine: CanvasEngine): BoundingBox | null {
  return engine.getActiveToolInstance().getSelectionBox?.() ?? null
}

/** @internal */
export function isTransforming(engine: CanvasEngine): boolean {
  const tool = engine.getActiveToolInstance()
  return Boolean(tool.isResizing?.() || tool.isRotating?.())
}

/** @internal */
export function isRotating(engine: CanvasEngine): boolean {
  return Boolean(engine.getActiveToolInstance().isRotating?.())
}
