import type { CanvasEngine } from "../engine/engine"
import { toCanvasPoint } from "../engine/internal"
import { computeMediaSize } from "../engine/media"
import type { MediaInput, MediaOptions, MediaRejectionReason } from "../options"
import type { Point } from "../types"
import { isEditableTarget } from "./editable-target"
import { getRelativePoint } from "./pointer"
import type { DomState } from "./state"

const DEFAULT_ACCEPT = ["image/*"]

function getFiles(data: DataTransfer | null): File[] {
  return data ? [...(data.files ?? [])] : []
}

function isAcceptedMimeType(
  mimeType: string,
  accept: readonly string[],
): boolean {
  return accept.some(
    (pattern) =>
      pattern === "*/*" ||
      pattern === mimeType ||
      (pattern.endsWith("/*") && mimeType.startsWith(pattern.slice(0, -1))),
  )
}

function reportRejection(
  options: MediaOptions,
  file: File,
  reason: MediaRejectionReason,
  error?: unknown,
): void {
  if (options.onRejected) {
    options.onRejected(file, reason, error)
    return
  }
  const name = file.name || "clipboard image"
  const type = file.type ? `, ${file.type}` : ""
  console.warn(`adraw: ignored "${name}" (${reason}${type}).`)
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function readMediaFile(
  file: File,
  options: MediaOptions,
): Promise<MediaInput | null> {
  let src: string
  try {
    src = await readFileAsDataURL(file)
  } catch (error) {
    reportRejection(options, file, "read-error", error)
    return null
  }

  let image: HTMLImageElement
  try {
    image = await loadImage(src)
  } catch (error) {
    reportRejection(options, file, "invalid-image", error)
    return null
  }

  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    reportRejection(
      options,
      file,
      "invalid-image",
      new Error("Image has no intrinsic dimensions"),
    )
    return null
  }

  return { mimeType: file.type, naturalHeight, naturalWidth, src }
}

async function insertMediaFiles(
  state: DomState,
  engine: CanvasEngine,
  files: File[],
  at: Point,
): Promise<void> {
  const options = engine.getMediaOptions()
  const accept = options.accept ?? DEFAULT_ACCEPT
  const accepted: File[] = []
  for (const file of files) {
    if (isAcceptedMimeType(file.type, accept)) {
      accepted.push(file)
    } else {
      reportRejection(options, file, "unsupported-type")
    }
  }

  const results = await Promise.all(
    accepted.map((file) => readMediaFile(file, options)),
  )
  if (!state.svgElement?.isConnected) {
    return
  }

  const inputs = results.filter((input): input is MediaInput => input !== null)
  if (inputs.length === 0) {
    return
  }

  const viewport = engine.getViewport()
  const canvasSize = engine.getCanvasSize()
  for (const input of inputs) {
    const { height, width } = computeMediaSize(input, viewport, canvasSize)
    Object.assign(input, {
      height,
      width,
      x: at.x - width / 2,
      y: at.y - height / 2,
    })
  }

  engine.insertMedia(inputs)
}

/**
 * Wire file drops and clipboard image paste to `insertMedia`. Images are
 * centered on the drop point. Paste uses the last pointer position, then the
 * viewport center.
 *
 * @internal
 */
export function setupMediaListeners(
  state: DomState,
  engine: CanvasEngine,
): () => void {
  const container = state.container
  const svgElement = state.svgElement
  if (!container || !svgElement || engine.getMediaOptions().enabled === false) {
    return () => {}
  }

  const shouldPreventDrop = (data: DataTransfer | null): boolean => {
    const types = data ? [...data.types] : []
    return types.includes("Files") || types.includes("text/uri-list")
  }

  const onDragOver = (event: DragEvent): void => {
    if (!shouldPreventDrop(event.dataTransfer)) {
      return
    }
    event.preventDefault()
  }

  const onDrop = (event: DragEvent): void => {
    if (!shouldPreventDrop(event.dataTransfer)) {
      return
    }
    // Stop the browser from navigating to dropped files or image URLs.
    event.preventDefault()
    const files = getFiles(event.dataTransfer)
    if (files.length === 0) {
      return
    }
    const { x, y } = getRelativePoint(state, event)
    void insertMediaFiles(state, engine, files, toCanvasPoint(engine, x, y))
  }

  container.addEventListener("dragover", onDragOver)
  container.addEventListener("drop", onDrop)

  const pasteTarget =
    engine.getKeyboardScope() === "document"
      ? svgElement.ownerDocument
      : svgElement
  const onPaste = (event: ClipboardEvent): void => {
    if (
      event.defaultPrevented ||
      isEditableTarget(event.target) ||
      state.textEditor
    ) {
      return
    }
    const files = getFiles(event.clipboardData)
    if (files.length === 0) {
      return
    }
    event.preventDefault()
    const viewport = engine.getViewport()
    const at = engine.getPointerPoint() ?? { x: viewport.x, y: viewport.y }
    void insertMediaFiles(state, engine, files, at)
  }
  pasteTarget.addEventListener("paste", onPaste as EventListener)

  return () => {
    container.removeEventListener("dragover", onDragOver)
    container.removeEventListener("drop", onDrop)
    pasteTarget.removeEventListener("paste", onPaste as EventListener)
  }
}
