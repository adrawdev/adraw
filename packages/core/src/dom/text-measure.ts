import {
  approximateLineWidth,
  measureTextLayout,
  type TextMeasurer,
} from "../text"

/**
 * Create a text measurer backed by the 2D canvas API. Falls back to the
 * character-count approximation when the document has no canvas context.
 *
 * @param doc Document that owns the scratch canvas.
 * @returns A measurer suitable for `CanvasEngine.setTextMeasurer`.
 */
export function createCanvasTextMeasurer(doc: Document): TextMeasurer {
  let context: CanvasRenderingContext2D | null = null
  let unavailable = false

  const measureLine = (
    line: string,
    fontSize: number,
    fontFamily: string,
  ): number => {
    if (!context && !unavailable) {
      context = doc.createElement("canvas").getContext("2d")
      unavailable = context === null
    }
    if (!context) {
      return approximateLineWidth(line, fontSize)
    }
    context.font = `${fontSize}px ${fontFamily}`
    return context.measureText(line).width
  }

  return (text, options) => measureTextLayout(text, options, measureLine)
}
