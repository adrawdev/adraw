import { STROKE_COLOR } from "../constants"
import type { CanvasEngine } from "../engine/engine"
import {
  commitTextEdit,
  dispatchPointerUp,
  reactivateActiveTool,
  restoreTextElement,
  setActiveToolText,
  updateTextElement,
} from "../engine/internal"
import { runStateOperation } from "../engine/state-notifier"
import type { EditableTextElement } from "../types"
import {
  positionTextEditor,
  renderAll,
  setTextElementVisibility,
} from "./render"
import type { DomState } from "./state"
import { textEditorClass } from "./svg"

// Start editing a committed text or note element in place. Live edits mutate
// the element directly; commit pushes history, cancel restores it. Selection is
// cleared while the editor is open so no resize/rotation handles compete with
// the caret; it comes back when the edit ends.
export function startExistingTextEditing(
  state: DomState,
  engine: CanvasEngine,
  element: EditableTextElement,
): void {
  if (!state.container) {
    return
  }
  state.textEditElementId = element.id
  state.textEditOriginalElement = element
  state.textEditPoint = { x: element.x, y: element.y }
  engine.setSelectedIds(new Set())
  // Editing normally happens with the select tool active, so the toolbar and
  // the next click behave like a finished text gesture. With the tool lock on,
  // leave it alone.
  if (engine.getActiveTool() === "text" && !engine.getIsToolLocked()) {
    engine.setActiveTool("select")
  }
  openTextEditor(
    state,
    engine,
    element.text,
    element.strokeColor || STROKE_COLOR,
  )
  renderAll(state, engine)
}

function openTextEditor(
  state: DomState,
  engine: CanvasEngine,
  value: string,
  color = STROKE_COLOR,
): void {
  if (!state.container || state.textEditor) {
    return
  }

  const body = state.container.ownerDocument.body
  if (!body) {
    return
  }

  const textarea = state.container.ownerDocument.createElement("textarea")
  textarea.classList.add(textEditorClass)
  textarea.value = value
  textarea.spellcheck = false
  textarea.style.background = "transparent"
  textarea.style.border = "0"
  textarea.style.boxSizing = "border-box"
  textarea.style.caretColor = color
  textarea.style.color = color
  textarea.style.margin = "0"
  textarea.style.outline = "none"
  textarea.style.overflow = "hidden"
  textarea.style.padding = "0"
  textarea.style.position = "absolute"
  textarea.style.resize = "none"
  textarea.style.transformOrigin = "center center"
  textarea.style.userSelect = "text"
  textarea.style.zIndex = "10"

  textarea.addEventListener("input", () => {
    runStateOperation(engine, () => {
      const next = textarea.value
      if (state.textEditElementId) {
        updateTextElement(engine, state.textEditElementId, next)
      } else {
        setActiveToolText(engine, next)
      }
      positionTextEditor(state, engine)
      renderAll(state, engine)
    })
  })

  textarea.addEventListener("keydown", (event) => {
    runStateOperation(engine, () => {
      if (event.isComposing) {
        return
      }
      // Excalidraw/tldraw semantics: Enter inserts a newline, while Escape and
      // Ctrl/Cmd+Enter finish editing.
      if (
        event.key === "Escape" ||
        (event.key === "Enter" && (event.ctrlKey || event.metaKey))
      ) {
        event.preventDefault()
        commitTextEditing(state, engine)
        // The editor lives outside the canvas, so focus would otherwise fall
        // back to the body. Return it so canvas-scoped shortcuts keep working
        // (e.g. toggling the tool lock with Q).
        state.svgElement?.focus({ preventScroll: true })
      }
    })
  })

  // Blur commits (clicking elsewhere). Pointerdown on the canvas commits first
  // via `handlePointerDown`, so this is only the fallback for clicks outside
  // the canvas.
  textarea.addEventListener("blur", () => {
    runStateOperation(engine, () => {
      commitTextEditing(state, engine)
    })
  })

  // Keep the editor outside the canvas container so it cannot change the
  // stacking order of controls that are siblings of the canvas.
  body.appendChild(textarea)
  state.textEditor = textarea
  positionTextEditor(state, engine)
  // Focusing synchronously is undone by the pointerdown's own default action
  // (the click that opened the editor moves focus to body and immediately
  // blurs it again), so defer to the next frame instead.
  requestAnimationFrame(() => {
    if (state.textEditor === textarea) {
      textarea.focus()
    }
  })
}

function removeTextEditor(state: DomState, engine: CanvasEngine): void {
  const editor = state.textEditor
  setTextElementVisibility(state, engine, true)
  // Null the ref first so a blur event fired by removal can't re-enter the
  // commit/cancel paths.
  state.textEditor = null
  editor?.remove()
}

export function commitTextEditing(
  state: DomState,
  engine: CanvasEngine,
  options: { switchTool?: boolean } = {},
): void {
  if (!state.textEditor) {
    return
  }

  const editingExisting = state.textEditElementId !== null
  const id = state.textEditElementId
  const point = state.textEditPoint
  const toolLocked = engine.getIsToolLocked()
  // A locked creation tool leaves the finished text/note unselected, ready for
  // the next gesture.
  const suppressSelection =
    toolLocked &&
    (engine.getActiveTool() === "text" || engine.getActiveTool() === "note")
  removeTextEditor(state, engine)

  if (editingExisting && id) {
    const before = engine.getElements().get(id)
    if (before?.type === "text") {
      // Restore a visible selection as the edit ends: the shape for a label,
      // the text itself for free text. An empty free text is deleted below and
      // commitTextEdit drops it from the selection again.
      if (!suppressSelection) {
        engine.setSelectedIds(new Set([before.containerId ?? before.id]))
      }
    } else if (before?.type === "note" && !suppressSelection) {
      engine.setSelectedIds(new Set([before.id]))
    }
    state.textEditElementId = null
    state.textEditOriginalElement = null
    commitTextEdit(engine, id)
    if (
      options.switchTool !== false &&
      engine.getActiveTool() === "text" &&
      !toolLocked
    ) {
      engine.setActiveTool("select")
    }
  } else if (point) {
    // Commit the text tool's temporary element (pushes history, selects,
    // switches back to select) exactly like a regular tool gesture end.
    dispatchPointerUp(engine, point, {} as PointerEvent)
  }

  state.textEditPoint = null
  renderAll(state, engine)
}

export function cancelTextEditing(state: DomState, engine: CanvasEngine): void {
  if (!state.textEditor) {
    return
  }

  const editingExisting = state.textEditElementId !== null
  const original = state.textEditOriginalElement
  const id = state.textEditElementId
  removeTextEditor(state, engine)
  state.textEditPoint = null
  state.textEditElementId = null
  state.textEditOriginalElement = null

  if (editingExisting && id && original) {
    restoreTextElement(engine, id, original)
  } else {
    // Reset the text tool so its temporary element disappears.
    reactivateActiveTool(engine)
  }
  renderAll(state, engine)
}
