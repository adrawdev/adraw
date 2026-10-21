import { measureTextSize } from "../elements"
import type { ToolOptions } from "../tools/base"
import type { CanvasElement } from "../types"

// Every style field a tool option can write back to an existing element.
type ApplicableToolOptions = ToolOptions & {
  cornerRadius?: number
  fontSize?: number
  smoothing?: number
}

/**
 * Apply the style fields a tool owns to one element. Fields the element does
 * not support are ignored, so `cornerRadius` only touches rectangles and
 * `fontSize` only touches text.
 *
 * @param element Element to restyle.
 * @param options Tool style options.
 * @returns The same element when nothing changed, otherwise a new element.
 */
export function applyToolOptionsToElement(
  element: CanvasElement,
  options: ApplicableToolOptions,
): CanvasElement {
  let next = element

  if ("strokeColor" in next && options.strokeColor !== undefined) {
    next = { ...next, strokeColor: options.strokeColor }
  }
  if ("strokeWidth" in next && options.strokeWidth !== undefined) {
    next = { ...next, strokeWidth: options.strokeWidth }
  }
  if (next.type === "rectangle" && options.cornerRadius !== undefined) {
    next = { ...next, cornerRadius: options.cornerRadius }
  }
  if (next.type === "path" && options.smoothing !== undefined) {
    next = { ...next, smoothing: options.smoothing }
  }
  if (next.type === "text" && options.fontSize !== undefined) {
    const size = measureTextSize(next.text, options.fontSize)
    next = {
      ...next,
      fontSize: options.fontSize,
      height: size.height,
      width: size.width,
    }
  }

  return next
}
