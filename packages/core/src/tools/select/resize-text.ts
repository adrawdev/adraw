import { measureTextElement, type TextMeasurer } from "../../text"
import type { TextElement } from "../../types"
import type { OriginalPosition } from "./state"

/** Resize inputs shared by the rotated and non-rotated select paths. */
export interface TextResizeOptions {
  /** Selection anchor used by the generic resize math. */
  anchorX: number
  /** Selection anchor used by the generic resize math. */
  anchorY: number
  changesHeight: boolean
  changesWidth: boolean
  /** True for the left/right edge handles, which set a fixed wrap width. */
  horizontalOnly: boolean
  scaleX: number
  scaleY: number
}

/**
 * Resize a text element following Excalidraw's semantics:
 *
 * - left/right edges switch the text to fixed width and wrap at the new width;
 * - top/bottom edges and corners scale the font size, re-measuring the box.
 *
 * The element is centered on the box the generic resize math would produce, so
 * multi-element selections keep their layout.
 *
 * @param original Style snapshot taken at pointer-down.
 * @param element Current text element.
 * @param options Resize axes and scale factors.
 * @param measurer Text measurer to use.
 * @returns The resized text element.
 */
export function resizeTextElement(
  original: OriginalPosition,
  element: TextElement,
  options: TextResizeOptions,
  measurer?: TextMeasurer,
): TextElement {
  const source = {
    autoSize: original.autoSize ?? element.autoSize ?? true,
    fontFamily: original.fontFamily ?? element.fontFamily,
    fontSize: original.fontSize ?? element.fontSize,
    lineHeight: original.lineHeight ?? element.lineHeight,
    textAlign: original.textAlign ?? element.textAlign,
  }

  let autoSize = source.autoSize
  let fontSize = source.fontSize
  let width = original.width

  if (options.horizontalOnly) {
    autoSize = false
    width = Math.max(1, original.width * Math.abs(options.scaleX))
  } else {
    const fontScale = options.changesWidth
      ? Math.abs(options.scaleX)
      : Math.abs(options.scaleY)
    fontSize = Math.max(1, fontSize * fontScale)
    if (!autoSize) {
      width = Math.max(
        1,
        original.width * (options.changesWidth ? Math.abs(options.scaleX) : 1),
      )
    }
  }

  const candidate: TextElement = {
    ...element,
    autoSize,
    fontFamily: source.fontFamily,
    fontSize,
    lineHeight: source.lineHeight,
    textAlign: source.textAlign,
    width,
  }
  const layout = measureTextElement(candidate, measurer)
  const finalWidth = autoSize ? layout.width : width

  // Box the generic resize would produce, handling a handle dragged past the
  // opposite edge (negative scale).
  let scaledX =
    options.anchorX + (original.x - options.anchorX) * options.scaleX
  let scaledWidth = original.width * options.scaleX
  if (scaledWidth < 0) {
    scaledX += scaledWidth
    scaledWidth = -scaledWidth
  }
  let scaledY =
    options.anchorY + (original.y - options.anchorY) * options.scaleY
  let scaledHeight = original.height * options.scaleY
  if (scaledHeight < 0) {
    scaledY += scaledHeight
    scaledHeight = -scaledHeight
  }

  return {
    ...candidate,
    height: layout.height,
    width: finalWidth,
    x: scaledX + scaledWidth / 2 - finalWidth / 2,
    y: scaledY + scaledHeight / 2 - layout.height / 2,
  }
}
