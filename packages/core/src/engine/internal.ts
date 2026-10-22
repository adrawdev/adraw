import { syncArrowBindings } from "../bindings"
import { measureNoteText } from "../note"
import { syncTextBindings } from "../text-bindings"
import type { TextTool } from "../tools"
import type { BoundingBox, EditableTextElement, ElementId } from "../types"
import type { EngineInternal } from "./engine"

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

// The minimal internal surface a `CanvasEngine` exposes to its DOM-adapter
// hooks (see the functions below). Everything here is `/** @internal */` on
// the engine — not part of the public API.
// ── Inline text-editing integration (used by the DOM adapter's editor) ──

// Push the editor's current text into the text tool's temporary element.
/** @internal */
export function setActiveToolText(engine: EngineInternal, text: string): void {
  const tool = engine.getActiveToolInstance()
  if (tool.type === "text") {
    ;(tool as TextTool).setText(text)
  }
}

// Reset the active tool so its temporary element disappears (used when
// cancelling a brand-new text edit).
/** @internal */
export function reactivateActiveTool(engine: EngineInternal): void {
  const tool = engine.getActiveToolInstance()
  const context = engine.getToolContext()
  tool.onDeactivate(context)
  tool.onActivate(context)
}

// Live-update a committed text or note element while the editor is open.
/** @internal */
export function updateTextElement(
  engine: EngineInternal,
  id: ElementId,
  text: string,
): void {
  const element = engine.getElements().get(id)
  if (!element || (element.type !== "text" && element.type !== "note")) {
    return
  }

  if (element.type === "note") {
    const layout = measureNoteText(
      { ...element, text },
      engine.getTextMeasurer(),
    )
    engine.getElements().set(id, {
      ...element,
      height: Math.max(element.height, layout.height + element.padding * 2),
      text,
    })
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
    engine.getElements().set(id, {
      ...element,
      height: layout.height,
      text,
      width: layout.width,
    })
  }

  syncTextBindings(engine.getElements(), engine.getTextMeasurer())
  syncArrowBindings(engine.getElements())
  engine.emit("change", { elements: engine.getElements() })
}

// Commit an edited text element: empty text deletes it (and drops it from the
// selection); otherwise the edits are kept. Pushes history unless recording is
// suppressed by `withoutHistory`.
/** @internal */
export function commitTextEdit(engine: EngineInternal, id: ElementId): void {
  const element = engine.getElements().get(id)
  if (!element || (element.type !== "text" && element.type !== "note")) {
    return
  }
  if (element.type === "text" && element.text.trim() === "") {
    // Deleting all text removes the element. Notes stay, even when empty.
    engine.getElements().delete(id)
    const selectedIds = engine.getSelectedIds()
    if (selectedIds.has(id)) {
      const next = new Set(selectedIds)
      next.delete(id)
      engine.setSelectedIds(next)
    }
  }
  syncArrowBindings(engine.getElements())
  engine.pushHistory()
  engine.emit("change", { elements: engine.getElements() })
}

// Restore the pre-edit snapshot of a text element (on cancel).
/** @internal */
export function restoreTextElement(
  engine: EngineInternal,
  id: ElementId,
  original: EditableTextElement,
): void {
  engine.getElements().set(id, original)
  syncArrowBindings(engine.getElements())
  engine.emit("change", { elements: engine.getElements() })
}

// ── Transform-overlay queries (used by the DOM adapter's renderer) ──

/** @internal */
export function getSelectionBox(engine: EngineInternal): BoundingBox | null {
  return engine.getActiveToolInstance().getSelectionBox?.() ?? null
}

/** @internal */
export function isTransforming(engine: EngineInternal): boolean {
  const tool = engine.getActiveToolInstance()
  return Boolean(tool.isResizing?.() || tool.isRotating?.())
}

/** @internal */
export function isRotating(engine: EngineInternal): boolean {
  return Boolean(engine.getActiveToolInstance().isRotating?.())
}
