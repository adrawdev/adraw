import type { SnappingConfig } from "./snapping"
import type { CanvasElement, ElementId, ToolType, ViewportState } from "./types"

export interface CanvasOptions {
  snapping?: Partial<SnappingConfig>
  initialViewport?: ViewportState
  // Hide the selection bounding box + resize/rotation handles while a
  // resize/rotation gesture is in progress, so the overlay doesn't lag the
  // element mid-gesture; it reappears on pointer up. Defaults to `true`.
  hideOverlayWhileTransforming?: boolean
}

export interface AdrawCanvasOptions extends CanvasOptions {
  // When provided, the canvas mounts into this container immediately. Omit it to
  // create a headless instance (state only) and call `mount(container)` later.
  container?: HTMLElement
}

export interface ToImageOptions {
  background?: boolean
  darkMode?: boolean
  format?: "png" | "jpeg" | "webp" | "svg"
  padding?: number
  scale?: number
  quality?: number
}

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

export interface CanvasEventMap {
  change: { elements: Map<ElementId, CanvasElement> }
  viewportChange: { viewport: ViewportState }
  toolChange: { tool: ToolType }
  selectionChange: { selectedIds: Set<ElementId> }
}
