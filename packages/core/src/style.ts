import { FILL_COLOR, STROKE_COLOR, STROKE_WIDTH } from "./constants"
import type { DrawToolOptions } from "./tools/draw"
import type { NoteToolOptions } from "./tools/note"
import type { RectangleToolOptions } from "./tools/rectangle"
import type { TextToolOptions } from "./tools/text"
import type { CanvasElementStyle } from "./types"

/**
 * Partial style options spanning every drawing tool, accepted by
 * `canvas.setStyle()`. Fields an element does not support are ignored, so
 * shared values such as `strokeWidth` apply everywhere while tool-specific
 * ones such as `smoothing`, `cornerRadius` or `fontSize` only reach the
 * elements that use them.
 */
export type StyleOptions = Partial<
  CanvasElementStyle &
    DrawToolOptions &
    NoteToolOptions &
    RectangleToolOptions &
    TextToolOptions
>

/**
 * Built-in style values used when neither the selection nor `setStyle`
 * provides one.
 */
export const DEFAULT_STYLE: Required<CanvasElementStyle> = {
  fillColor: FILL_COLOR,
  opacity: 1,
  strokeColor: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
}
