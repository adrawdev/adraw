import { SELECTION_COLOR, STROKE_COLOR } from "../constants"
import type { CanvasEngine } from "../engine/engine"
import {
  commitTextEdit,
  dispatchPointerDown,
  dispatchPointerUp,
  reactivateActiveTool,
  restoreTextElement,
  setActiveToolText,
  updateTextElement,
} from "../engine/internal"
import type { Point, TextElement } from "../types"
import { positionTextEditor, renderAll } from "./render"
import type { DomState } from "./state"
import { textEditorClass } from "./svg"

// Start editing a brand-new text element: the text tool creates its temporary
// element, then the editor overlay appears on top of it.
export function startTextEditing(
  state: DomState,
  engine: CanvasEngine,
  point: Point,
  event: PointerEvent,
): void {
  if (!state.container) {
    return
  }
  dispatchPointerDown(engine, point, event)
  state.textEditPoint = point
  openTextEditor(state, engine, "")
}

// Start editing an existing (committed) text element in place. Live edits
// mutate the element directly; commit pushes history, cancel restores it.
export function startExistingTextEditing(
  state: DomState,
  engine: CanvasEngine,
  element: TextElement,
): void {
  if (!state.container) {
    return
  }
  state.textEditElementId = element.id
  state.textEditOriginalElement = element
  state.textEditPoint = { x: element.x, y: element.y }
  openTextEditor(state, engine, element.text)
}

function openTextEditor(
  state: DomState,
  engine: CanvasEngine,
  value: string,
): void {
  if (!state.container || state.textEditor) {
    return
  }

  const textarea = document.createElement("textarea")
  textarea.classList.add(textEditorClass)
  textarea.value = value
  // The editor is absolutely positioned in canvas-screen coordinates, so the
  // container must act as its positioning context.
  if (getComputedStyle(state.container).position === "static") {
    state.container.style.position = "relative"
  }
  textarea.style.background = "transparent"
  textarea.style.border = `1px dashed ${SELECTION_COLOR}`
  textarea.style.color = STROKE_COLOR
  textarea.style.fontFamily = "system-ui, sans-serif"
  textarea.style.margin = "0"
  textarea.style.outline = "none"
  textarea.style.overflow = "hidden"
  textarea.style.padding = "0"
  textarea.style.position = "absolute"
  textarea.style.resize = "none"
  textarea.style.whiteSpace = "pre"
  textarea.style.zIndex = "10"
  textarea.setAttribute("wrap", "off")

  textarea.addEventListener("input", () => {
    const next = textarea.value
    if (state.textEditElementId) {
      updateTextElement(engine, state.textEditElementId, next)
    } else {
      setActiveToolText(engine, next)
    }
    positionTextEditor(state, engine)
    renderAll(state, engine)
  })

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      commitTextEditing(state, engine)
    } else if (event.key === "Escape") {
      event.preventDefault()
      cancelTextEditing(state, engine)
    }
  })

  // Blur commits (clicking elsewhere). Pointerdown on the canvas commits first
  // via `handlePointerDown`, so this is only the fallback for clicks outside
  // the canvas.
  textarea.addEventListener("blur", () => {
    commitTextEditing(state, engine)
  })

  state.container.appendChild(textarea)
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

function removeTextEditor(state: DomState): void {
  const editor = state.textEditor
  // Null the ref first so a blur event fired by removal can't re-enter the
  // commit/cancel paths.
  state.textEditor = null
  editor?.remove()
}

export function commitTextEditing(state: DomState, engine: CanvasEngine): void {
  if (!state.textEditor) {
    return
  }

  const editingExisting = state.textEditElementId !== null
  const id = state.textEditElementId
  const point = state.textEditPoint
  removeTextEditor(state)

  if (editingExisting && id) {
    state.textEditElementId = null
    state.textEditOriginalElement = null
    commitTextEdit(engine, id)
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
  removeTextEditor(state)
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
