import { createMedia } from "../elements"
import type { MediaInput } from "../options"
import type { MediaElement, ViewportState } from "../types"

// Sizing rules for `insertMedia`: explicit dimensions win, then a single
// explicit dimension keeps the aspect ratio, then fit within the visible
// viewport (minus padding), then fall back to the natural size.
function computeMediaSize(
  input: MediaInput,
  viewport: ViewportState,
  canvasSize: { width: number; height: number },
): { height: number; width: number } {
  if (input.width != null && input.height != null) {
    return { height: input.height, width: input.width }
  }
  if (input.width != null) {
    return {
      height: Math.round(
        (input.width / input.naturalWidth) * input.naturalHeight,
      ),
      width: input.width,
    }
  }
  if (input.height != null) {
    return {
      height: input.height,
      width: Math.round(
        (input.height / input.naturalHeight) * input.naturalWidth,
      ),
    }
  }
  if (canvasSize.width > 0 && canvasSize.height > 0) {
    const visibleWidth = canvasSize.width / viewport.zoom
    const visibleHeight = canvasSize.height / viewport.zoom
    const padding = 100 / viewport.zoom
    const availableWidth = Math.max(1, visibleWidth - padding)
    const availableHeight = Math.max(1, visibleHeight - padding)
    const scale = Math.min(
      availableWidth / input.naturalWidth,
      availableHeight / input.naturalHeight,
      1,
    )
    return {
      height: Math.round(input.naturalHeight * scale),
      width: Math.round(input.naturalWidth * scale),
    }
  }
  return { height: input.naturalHeight, width: input.naturalWidth }
}

export function createMediaElements(
  inputs: MediaInput[],
  viewport: ViewportState,
  canvasSize: { width: number; height: number },
  baseZIndex: number,
): MediaElement[] {
  const elements: MediaElement[] = []
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const { height, width } = computeMediaSize(input, viewport, canvasSize)
    const x = input.x ?? viewport.x - width / 2
    const y = input.y ?? viewport.y - height / 2
    elements.push(
      createMedia({
        height,
        locked: false,
        mimeType: input.mimeType,
        naturalHeight: input.naturalHeight,
        naturalWidth: input.naturalWidth,
        rotation: 0,
        src: input.src,
        visible: true,
        width,
        x,
        y,
        zIndex: baseZIndex + i,
      }),
    )
  }
  return elements
}
