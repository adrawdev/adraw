import type { CanvasEngine } from "../engine/engine"
import { isEditableTarget } from "./editable-target"
import type { DomState } from "./state"

/**
 * Structured clipboard MIME type. `text/plain` carries the same JSON so browsers
 * and tabs that strip custom types can still paste structured content.
 */
const ADRAW_CLIPBOARD_TYPE = "application/x-adraw+json"
const TEXT_CLIPBOARD_TYPE = "text/plain"

function writeCopyPayload(
  event: ClipboardEvent,
  engine: CanvasEngine,
  cut: boolean,
): void {
  if (event.defaultPrevented) {
    return
  }

  const elements = cut ? engine.cut() : engine.copy()
  if (elements.length === 0) {
    return
  }

  // The in-memory buffer is already updated. If the browser denies clipboard
  // access, in-canvas paste still works through the fallback path.
  const payload = engine.serializeClipboard()
  const data = event.clipboardData
  if (!payload || !data) {
    return
  }

  let wrote = false
  try {
    data.setData(TEXT_CLIPBOARD_TYPE, payload)
    wrote = true
  } catch {
    // Try the structured type below; the in-memory buffer remains a fallback.
  }
  try {
    data.setData(ADRAW_CLIPBOARD_TYPE, payload)
    wrote = true
  } catch {
    // text/plain is enough for cross-tab paste when custom types are blocked.
  }
  if (wrote) {
    event.preventDefault()
  }
}

type PasteOutcome = "fallback" | "handled" | "ignore"

function readPastePayload(
  event: ClipboardEvent,
  engine: CanvasEngine,
): PasteOutcome {
  const data = event.clipboardData
  if (!data) {
    return "fallback"
  }

  const structured = data.getData(ADRAW_CLIPBOARD_TYPE)
  if (structured && engine.deserializeClipboard(structured)) {
    return "handled"
  }

  const plain = data.getData(TEXT_CLIPBOARD_TYPE)
  if (plain && engine.deserializeClipboard(plain)) {
    return "handled"
  }

  if (data.types.length === 0) {
    return "fallback"
  }

  const offersCanvasPayload =
    data.types.includes(ADRAW_CLIPBOARD_TYPE) ||
    data.types.includes(TEXT_CLIPBOARD_TYPE)
  if (!offersCanvasPayload) {
    // Another app put files or rich media on the clipboard. Do not replace it
    // with stale in-memory canvas content.
    return "ignore"
  }

  // The recognized types are present but inaccessible or empty, which is how
  // some browsers report denied clipboard access. Fall back to memory.
  return structured || plain ? "ignore" : "fallback"
}

function handlePaste(event: ClipboardEvent, engine: CanvasEngine): void {
  if (event.defaultPrevented) {
    return
  }

  const outcome = readPastePayload(event, engine)
  if (outcome === "fallback") {
    if (engine.paste().length > 0) {
      event.preventDefault()
    }
    return
  }
  if (outcome === "handled") {
    engine.paste()
    event.preventDefault()
  }
}

/**
 * Wire native copy/cut/paste to the engine. Event targets follow the keyboard
 * scope; editable targets are left untouched so the inline text editor and form
 * fields keep native behavior.
 *
 * @internal
 */
export function setupClipboardListeners(
  state: DomState,
  engine: CanvasEngine,
): () => void {
  const svgElement = state.svgElement
  if (!svgElement || !engine.handlesSystemClipboard()) {
    return () => {}
  }

  const target =
    engine.getKeyboardScope() === "document"
      ? svgElement.ownerDocument
      : svgElement

  const onCopy = (event: ClipboardEvent): void => {
    if (!isEditableTarget(event.target)) {
      writeCopyPayload(event, engine, false)
    }
  }
  const onCut = (event: ClipboardEvent): void => {
    if (!isEditableTarget(event.target)) {
      writeCopyPayload(event, engine, true)
    }
  }
  const onPaste = (event: ClipboardEvent): void => {
    if (isEditableTarget(event.target) || state.textEditor) {
      return
    }
    handlePaste(event, engine)
  }

  target.addEventListener("copy", onCopy as EventListener)
  target.addEventListener("cut", onCut as EventListener)
  target.addEventListener("paste", onPaste as EventListener)

  return () => {
    target.removeEventListener("copy", onCopy as EventListener)
    target.removeEventListener("cut", onCut as EventListener)
    target.removeEventListener("paste", onPaste as EventListener)
  }
}
