import type { SnappingConfig } from "./snapping"
import type { CanvasElement, ElementId, ToolType, ViewportState } from "./types"

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
 * Options passed to the {@link AdrawCanvas} constructor and to the
 * framework-binding canvas providers.
 */
export interface CanvasOptions {
  /** Serialization hooks bridging the in-memory clipboard to the system clipboard. */
  clipboard?: ClipboardOptions
  /** When `true`, snapping is active by default during a drag. When `false` (default), snapping only activates while Ctrl/Cmd is held. */
  isSnapMode?: boolean
  /** Starting viewport; defaults to origin/zoom 1. */
  initialViewport?: ViewportState
  /** Snapping configuration (threshold in pixels). */
  snapping?: Partial<SnappingConfig>
  /** Hide the selection bounding box + resize/rotation handles while a resize/rotation gesture is in progress, reappearing on pointer up. Defaults to `true`. */
  hideOverlayWhileTransforming?: boolean
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
  /** Whether to paint the background. */
  background?: boolean
  /** Use dark-mode colors. */
  darkMode?: boolean
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

/**
 * Events emitted by an {@link AdrawCanvas} / {@link CanvasEngine}. Listen
 * with `canvas.on(event, handler)` / `canvas.off(event, handler)`.
 */
export interface CanvasEventMap {
  /** Fired after elements change (draw, erase, undo, redo, delete). */
  change: { elements: Map<ElementId, CanvasElement> }
  /** Fired after pan/zoom changes. */
  viewportChange: { viewport: ViewportState }
  /** Fired after the active tool changes. */
  toolChange: { tool: ToolType }
  /** Fired after the selection changes. */
  selectionChange: { selectedIds: Set<ElementId> }
}
