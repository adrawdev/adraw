/**
 * Default canvas background color.
 */
export const BACKGROUND_COLOR =
  "var(--adraw-background, light-dark(#fff, #1e1e1e))"

/**
 * Default element fill color (transparent by default).
 */
export const FILL_COLOR = "var(--adraw-fill, transparent)"

/**
 * Color used to outline the current selection.
 */
export const SELECTION_COLOR = "var(--adraw-selection, #228be6)"

/**
 * Default stroke color for drawn elements.
 */
export const STROKE_COLOR = "var(--adraw-stroke, light-dark(#000, #fff))"

/**
 * Default stroke width in pixels.
 */
export const STROKE_WIDTH = 2

/**
 * Default font size used for text elements, in pixels.
 */
export const TEXT_FONT_SIZE = 20

/**
 * Default font family stack used for text elements.
 */
export const TEXT_FONT_FAMILY = "system-ui, sans-serif"

/**
 * Default unitless line height for text elements. The rendered line height in
 * pixels is `fontSize * TEXT_LINE_HEIGHT`.
 */
export const TEXT_LINE_HEIGHT = 1.25

/**
 * Inner padding, in pixels, between a shape and the text bound to it.
 */
export const BOUND_TEXT_PADDING = 5

/**
 * How close (in screen pixels) a click with the text tool must be to a shape's
 * center to create a label instead of a free text element.
 */
export const TEXT_CONTAINER_SNAP_THRESHOLD = 30
