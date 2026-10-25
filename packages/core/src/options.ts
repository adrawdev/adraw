import type { SnappingConfig } from "./snapping"
import type { TextMeasurer } from "./text"
import type { CanvasDocument, CanvasElement, ViewportState } from "./types"
import type { ViewportConfig } from "./viewport"

/**
 * Serialization hooks bridging the in-memory clipboard to the system clipboard
 * (or any other transport).
 */
export interface ClipboardOptions {
  /**
   * Custom parser for {@link AdrawCanvas.deserializeClipboard}; return null to
   * reject the data and keep the current in-memory clipboard. Defaults to
   * parsing an `adraw/clipboard` JSON envelope.
   */
  deserialize?: (data: string) => CanvasElement[] | null
  /**
   * Custom serializer for {@link AdrawCanvas.serializeClipboard}; defaults to an
   * `adraw/clipboard` JSON envelope.
   */
  serialize?: (elements: CanvasElement[]) => string
}

/**
 * Where the canvas handles its built-in keyboard shortcuts.
 *
 * - `"canvas"` (default): only while the canvas has focus. The SVG is made
 *   focusable and takes focus on pointer down, so shortcuts never leak into
 *   forms, dialogs or other widgets on the page.
 * - `"document"`: anywhere on the page. Form controls are still ignored.
 * - `"none"`: built-in shortcuts are disabled; call `canvas.handleKeyDown`
 *   yourself when needed.
 */
export type KeyboardScope = "canvas" | "document" | "none"

/**
 * Options passed to the {@link AdrawCanvas} constructor and to the
 * framework-binding canvas providers.
 */
export interface CanvasOptions {
  /** Serialization hooks bridging the in-memory clipboard to the system clipboard. */
  clipboard?: ClipboardOptions
  /** When `true`, snapping is active by default during a drag. When `false` (default), snapping only activates while Ctrl/Cmd is held. */
  isSnapMode?: boolean
  /** Keyboard shortcut scope. Defaults to `"canvas"`; use `"document"` for page-wide shortcuts or `"none"` to disable them. */
  keyboard?: KeyboardScope
  /**
   * Text measurer used to size and wrap text elements. Defaults to a
   * character-count approximation in headless mode; `AdrawCanvas.mount`
   * installs a canvas-backed measurer when this option is omitted.
   *
   * @example
   * ```ts
   * const canvas = new AdrawCanvas({
   *   measureText: (text, options) => measureTextLayout(text, options),
   * })
   * ```
   */
  measureText?: TextMeasurer
  /** Starting viewport; defaults to origin/zoom 1. */
  initialViewport?: ViewportState
  /**
   * Elements loaded when the engine is constructed. They become part of the
   * initial history baseline, so the first undo does not remove them.
   * Ignored when `initialDocument` is provided.
   */
  initialElements?: CanvasElement[]
  /**
   * Serialized document loaded when the engine is constructed. Takes
   * precedence over `initialElements` and becomes the history baseline.
   */
  initialDocument?: CanvasDocument
  /**
   * Zoom/pan behavior. Defaults: `minZoom` 0.1, `maxZoom` 10,
   * `zoomSensitivity` 0.001, `fitPadding` 32 and `constrainToContent` false.
   *
   * @example
   * ```ts
   * const canvas = new AdrawCanvas({
   *   container,
   *   viewport: { minZoom: 0.25, maxZoom: 8, fitPadding: 64, constrainToContent: true },
   * })
   * ```
   */
  viewport?: Partial<ViewportConfig>
  /** Snapping configuration (threshold in pixels). */
  snapping?: Partial<SnappingConfig>
  /** Hide the selection bounding box + resize/rotation handles while a resize/rotation gesture is in progress, reappearing on pointer up. Defaults to `false` in the core; the framework adapters default to `true`. */
  hideOverlayWhileTransforming?: boolean
  /**
   * Lock the active drawing tool so it stays active after creating an element
   * instead of switching back to the selection tool. Applies to the rectangle,
   * ellipse, diamond, line, arrow, text and note tools; the draw and eraser
   * tools always stay active. Defaults to `false`.
   *
   * @example
   * ```ts
   * const canvas = new AdrawCanvas({ container, isToolLocked: true })
   * ```
   */
  isToolLocked?: boolean
}

/**
 * Options accepted by the {@link AdrawCanvas} constructor. Extends
 * {@link CanvasOptions} with an optional container to mount immediately.
 */
export interface AdrawCanvasOptions extends CanvasOptions {
  /** When provided, the canvas mounts into this container immediately. Omit it to create a headless instance and call `mount(container)` later. */
  container?: HTMLElement
}

/**
 * Options for exporting the canvas to an image.
 */
export interface ToImageOptions {
  /**
   * Background paint of the exported image. `true` fills it with the
   * container's `--adraw-background` color; a string uses that CSS color
   * instead. Defaults to `false` (transparent PNG/WebP/SVG). JPEG has no
   * alpha channel, so it always paints the background.
   */
  background?: boolean | string
  /** Use dark-mode colors. Ignored by an explicit `background` color. */
  darkMode?: boolean
  /**
   * Elements to leave out of the export, e.g.
   * `exclude: (element) => element.id === gridId`. Excluded elements also do
   * not contribute to the exported bounds. Locked elements are included by
   * default — they are content, just not editable.
   */
  exclude?: (element: CanvasElement) => boolean
  /** Output image format. */
  format?: "png" | "jpeg" | "webp" | "svg"
  /** Padding around the exported region, in pixels. */
  padding?: number
  /** Resolution multiplier. */
  scale?: number
  /** Image quality (0–1) for lossy formats. */
  quality?: number
}

/**
 * Input describing a media (image) element to insert.
 */
export interface MediaInput {
  src: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
  x?: number
  y?: number
  width?: number
  height?: number
}
