import { measureNoteText } from "../note"
import {
  approximateTextMeasurer,
  measureTextElement,
  type TextMeasurer,
} from "../text"
import type { ToolOptions } from "../tools/base"
import type { CanvasElement, TextAlign } from "../types"

// Every style field a tool option can write back to an existing element.
type ApplicableToolOptions = ToolOptions & {
  autoSize?: boolean
  cornerRadius?: number
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  padding?: number
  smoothing?: number
  textAlign?: TextAlign
}

/**
 * Apply the style fields a tool owns to one element. Fields the element does
 * not support are ignored: `fillColor` touches rectangles, ellipses and notes,
 * `cornerRadius` touches rectangles and notes, and the text options touch text
 * and notes.
 *
 * @param element Element to restyle.
 * @param options Tool style options.
 * @param measurer Text measurer used to recompute a text element's box.
 * @returns The same element when nothing changed, otherwise a new element.
 */
export function applyToolOptionsToElement(
  element: CanvasElement,
  options: ApplicableToolOptions,
  measurer: TextMeasurer = approximateTextMeasurer,
): CanvasElement {
  let next = element

  if ("strokeColor" in next && options.strokeColor !== undefined) {
    next = { ...next, strokeColor: options.strokeColor }
  }
  if ("strokeWidth" in next && options.strokeWidth !== undefined) {
    next = { ...next, strokeWidth: options.strokeWidth }
  }
  if (
    (next.type === "rectangle" ||
      next.type === "ellipse" ||
      next.type === "note") &&
    options.fillColor !== undefined &&
    next.fillColor !== options.fillColor
  ) {
    next = { ...next, fillColor: options.fillColor }
  }
  if (options.opacity !== undefined && next.opacity !== options.opacity) {
    next = { ...next, opacity: options.opacity }
  }
  if (
    (next.type === "rectangle" || next.type === "note") &&
    options.cornerRadius !== undefined
  ) {
    next = { ...next, cornerRadius: options.cornerRadius }
  }
  if (next.type === "note" && options.padding !== undefined) {
    next = { ...next, padding: options.padding }
  }
  if (next.type === "path" && options.smoothing !== undefined) {
    next = { ...next, smoothing: options.smoothing }
  }
  if (next.type === "text" || next.type === "note") {
    let text = next
    if (options.fontSize !== undefined && options.fontSize !== text.fontSize) {
      text = { ...text, fontSize: options.fontSize }
    }
    if (
      options.fontFamily !== undefined &&
      options.fontFamily !== text.fontFamily
    ) {
      text = { ...text, fontFamily: options.fontFamily }
    }
    if (
      options.textAlign !== undefined &&
      options.textAlign !== text.textAlign
    ) {
      text = { ...text, textAlign: options.textAlign }
    }
    if (
      options.lineHeight !== undefined &&
      options.lineHeight !== text.lineHeight
    ) {
      text = { ...text, lineHeight: options.lineHeight }
    }
    if (
      text.type === "text" &&
      options.autoSize !== undefined &&
      options.autoSize !== text.autoSize
    ) {
      text = { ...text, autoSize: options.autoSize }
    }
    if (text !== next) {
      if (text.type === "note") {
        const layout = measureNoteText(text, measurer)
        next = {
          ...text,
          height: Math.max(text.height, layout.height + text.padding * 2),
        }
      } else {
        const layout = measureTextElement(text, measurer)
        next = { ...text, height: layout.height, width: layout.width }
      }
    }
  }

  return next
}
