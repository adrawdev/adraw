import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "./constants"
import type { Size, TextAlign, TextElement } from "./types"

/**
 * Input accepted by a {@link TextMeasurer}. Every optional field falls back to
 * the same default used by the renderer.
 */
export interface TextLayoutOptions {
  /** Font size in pixels. */
  fontSize: number
  /** Font family stack. Defaults to the built-in system font stack. */
  fontFamily?: string
  /** Unitless line height multiplier. Defaults to `1.25`. */
  lineHeight?: number
  /**
   * When `true` (default) no wrapping is applied: only explicit `\n`
   * characters break lines. When `false`, lines wrap at `maxWidth`.
   */
  autoSize?: boolean
  /** Wrap width in pixels. Used when `autoSize` is `false`. */
  maxWidth?: number
  /**
   * When `true` (with `autoSize: false`), wrap at `maxWidth` but size the box
   * to the longest wrapped line instead of the full `maxWidth`. Used by bound text
   * bound to a shape so their editor grows and shrinks with the text.
   */
  shrinkWidth?: boolean
}

/**
 * Result of laying out a piece of text: the element box and the lines to
 * render.
 */
export interface TextLayout extends Size {
  /** Lines after applying explicit and (when fixed-width) soft wrapping. */
  lines: string[]
}

/**
 * Measures one line of text without wrapping.
 *
 * @param line Text to measure.
 * @param fontSize Font size in pixels.
 * @param fontFamily Font family stack.
 * @returns Line width in pixels.
 */
export type LineMeasurer = (
  line: string,
  fontSize: number,
  fontFamily: string,
) => number

/**
 * Measures and lays out text for a text element. The DOM adapter installs a
 * canvas-backed measurer on `AdrawCanvas.mount`; the headless fallback uses an
 * approximation based on character count.
 *
 * @param text Source text.
 * @param options Font metrics and wrapping options.
 * @returns Box size and wrapped lines.
 * @example
 * ```ts
 * const measurer: TextMeasurer = (text, options) =>
 *   measureTextLayout(text, options)
 * const layout = measurer("Hello", { fontSize: 20 })
 * ```
 */
export type TextMeasurer = (
  text: string,
  options: TextLayoutOptions,
) => TextLayout

/**
 * Approximate width of a line at ~0.6em per UTF-16 code unit. Used when no DOM
 * measurer is available (headless engines, SSR and unit tests).
 *
 * @param line Text to measure.
 * @param fontSize Font size in pixels.
 * @returns Approximate width in pixels.
 */
export function approximateLineWidth(line: string, fontSize: number): number {
  return line.length * fontSize * 0.6
}

function breakWord(
  word: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const chunks: string[] = []
  let chunk = ""
  for (const char of word) {
    const candidate = chunk + char
    if (chunk && measure(candidate) > maxWidth) {
      chunks.push(chunk)
      chunk = char
    } else {
      chunk = candidate
    }
  }
  if (chunk || chunks.length === 0) {
    chunks.push(chunk)
  }
  return chunks
}

function wrapLine(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  if (text === "") {
    return [""]
  }

  const lines: string[] = []
  let current = ""

  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word

    if (current === "" || measure(candidate) <= maxWidth) {
      if (current === "" && measure(word) > maxWidth) {
        const chunks = breakWord(word, maxWidth, measure)
        lines.push(...chunks.slice(0, -1))
        current = chunks.at(-1) ?? ""
      } else {
        current = candidate
      }
      continue
    }

    lines.push(current)
    current = word
    if (measure(word) > maxWidth) {
      const chunks = breakWord(word, maxWidth, measure)
      lines.push(...chunks.slice(0, -1))
      current = chunks.at(-1) ?? ""
    }
  }

  lines.push(current)
  return lines
}

/**
 * Lay out text for a text element.
 *
 * @param text Source text.
 * @param options Font metrics and wrapping options.
 * @param measureLine Line measurer. Defaults to {@link approximateLineWidth}.
 * @returns Box size and wrapped lines.
 * @example
 * ```ts
 * measureTextLayout("Hello world", { autoSize: false, fontSize: 20, maxWidth: 100 })
 * // { width: 100, height: 50, lines: ["Hello", "world"] }
 * ```
 */
export function measureTextLayout(
  text: string,
  options: TextLayoutOptions,
  measureLine: LineMeasurer = approximateLineWidth,
): TextLayout {
  const fontSize = Math.max(1, options.fontSize)
  const fontFamily = options.fontFamily ?? TEXT_FONT_FAMILY
  const autoSize = options.autoSize ?? true
  const lineHeight = fontSize * (options.lineHeight ?? TEXT_LINE_HEIGHT)
  const measure = (line: string) => measureLine(line, fontSize, fontFamily)
  const explicitLines = text.split("\n")

  let lines = explicitLines
  if (!autoSize && options.maxWidth !== undefined) {
    const maxWidth = Math.max(1, options.maxWidth)
    lines = explicitLines.flatMap((line) => wrapLine(line, maxWidth, measure))
  }

  let width = 1
  for (const line of lines) {
    width = Math.max(width, measure(line))
  }
  if (!autoSize && options.maxWidth !== undefined && !options.shrinkWidth) {
    width = Math.max(1, options.maxWidth)
  }

  return {
    height: Math.max(1, lines.length) * lineHeight,
    lines,
    width,
  }
}

/**
 * Built-in text measurer. Uses the approximation from
 * {@link approximateLineWidth}, so the headless engine and unit tests stay
 * dependency-free and deterministic.
 */
export const approximateTextMeasurer: TextMeasurer = (text, options) =>
  measureTextLayout(text, options)

/**
 * Measure a text element with the given measurer, preserving its style.
 *
 * @param element Text element to measure.
 * @param measurer Measurer to use. Defaults to {@link approximateTextMeasurer}.
 * @returns Box size and wrapped lines.
 */
export function measureTextElement(
  element: TextElement,
  measurer: TextMeasurer = approximateTextMeasurer,
): TextLayout {
  const maxWidth = element.wrapWidth ?? element.width
  return measurer(element.text, {
    autoSize: element.autoSize,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    lineHeight: element.lineHeight,
    maxWidth,
    shrinkWidth:
      element.containerId !== null && element.containerId !== undefined,
  })
}

/**
 * Lines to render for a text element. Auto-sized text only breaks on explicit
 * `\n`; fixed-width text is wrapped with the same measurer used for its box.
 *
 * @param element Text element.
 * @param measurer Measurer used for fixed-width wrapping.
 * @returns Lines in render order.
 */
export function getTextLines(
  element: TextElement,
  measurer: TextMeasurer = approximateTextMeasurer,
): string[] {
  if (element.autoSize !== false) {
    return element.text.split("\n")
  }
  return measureTextElement(element, measurer).lines
}

/**
 * Rendered line height of a text element, in pixels.
 *
 * @param element Text element.
 * @returns `fontSize * lineHeight`.
 */
export function getTextLineHeightPx(element: TextElement): number {
  return element.fontSize * (element.lineHeight ?? TEXT_LINE_HEIGHT)
}

/**
 * Half-leading applied above the first line so SVG text lines up with the
 * line boxes used by the HTML editor overlay.
 *
 * @param element Text element.
 * @returns Vertical inset in pixels.
 */
export function getTextLeading(element: TextElement): number {
  return Math.max(0, (getTextLineHeightPx(element) - element.fontSize) / 2)
}

/**
 * SVG `text-anchor` matching a text element's alignment.
 *
 * @param element Text element.
 * @returns `"start"`, `"middle"` or `"end"`.
 */
export function getTextAnchor(
  element: Pick<TextElement, "textAlign">,
): "start" | "middle" | "end" {
  switch (element.textAlign) {
    case "center": {
      return "middle"
    }
    case "right": {
      return "end"
    }
    default: {
      return "start"
    }
  }
}

/**
 * X coordinate of every rendered line, relative to the element box.
 *
 * @param element Text element.
 * @returns `0` for left, `width / 2` for center and `width` for right.
 */
export function getTextLineX(
  element: Pick<TextElement, "textAlign" | "width">,
) {
  const align: TextAlign = element.textAlign ?? "left"
  if (align === "center") {
    return element.width / 2
  }
  if (align === "right") {
    return element.width
  }
  return 0
}
