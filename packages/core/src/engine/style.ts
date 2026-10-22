import { FILL_COLOR, TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "../constants"
import { DEFAULT_PATH_SMOOTHING } from "../elements"
import { measureNoteText } from "../note"
import type { StyleOptions } from "../style"
import {
  approximateTextMeasurer,
  measureTextElement,
  type TextMeasurer,
} from "../text"
import type { CanvasElement, CanvasElementStyle, TextAlign } from "../types"

// Every style field a tool option can write back to an existing element.
type ApplicableStyle = CanvasElementStyle & {
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
 * Apply the style fields an element supports. Fields it does not support are
 * ignored: `fillColor` touches rectangles, ellipses and notes, `cornerRadius`
 * touches rectangles and notes, and the text options touch text and notes.
 *
 * @param element Element to restyle.
 * @param options Style options to apply.
 * @param measurer Text measurer used to recompute a text element's box.
 * @returns The same element when nothing changed, otherwise a new element.
 */
export function applyStyleToElement(
  element: CanvasElement,
  options: ApplicableStyle,
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

/**
 * Read the effective style options from one element. Optional fields fall back
 * to the same defaults used when the element is created, and fields the element
 * type does not support are omitted.
 *
 * @param element Element to inspect.
 * @returns Style options supported by the element.
 */
export function getElementStyle(element: CanvasElement): StyleOptions {
  const style: StyleOptions = { opacity: element.opacity ?? 1 }

  if ("strokeColor" in element) {
    style.strokeColor = element.strokeColor
  }
  if ("strokeWidth" in element) {
    style.strokeWidth = element.strokeWidth
  }

  switch (element.type) {
    case "ellipse": {
      style.fillColor = element.fillColor ?? FILL_COLOR
      break
    }
    case "note": {
      style.cornerRadius = element.cornerRadius
      style.fillColor = element.fillColor
      style.fontFamily = element.fontFamily ?? TEXT_FONT_FAMILY
      style.fontSize = element.fontSize
      style.lineHeight = element.lineHeight ?? TEXT_LINE_HEIGHT
      style.padding = element.padding
      style.textAlign = element.textAlign ?? "center"
      break
    }
    case "path": {
      style.smoothing = element.smoothing ?? DEFAULT_PATH_SMOOTHING
      break
    }
    case "rectangle": {
      style.cornerRadius = element.cornerRadius
      style.fillColor = element.fillColor ?? FILL_COLOR
      break
    }
    case "text": {
      style.autoSize = element.autoSize ?? true
      style.fontFamily = element.fontFamily ?? TEXT_FONT_FAMILY
      style.fontSize = element.fontSize
      style.lineHeight = element.lineHeight ?? TEXT_LINE_HEIGHT
      style.textAlign = element.textAlign ?? "left"
      break
    }
    default: {
      break
    }
  }

  return style
}
