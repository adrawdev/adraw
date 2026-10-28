/**
 * A point in 2D (canvas or screen) coordinate space.
 */
export interface Point {
  x: number
  y: number
}

/**
 * A width/height size.
 */
export interface Size {
  width: number
  height: number
}

/**
 * An axis-aligned bounding box.
 */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Unique identifier for a canvas element.
 */
export type ElementId = string

/**
 * The kind of drawable element that can live on the canvas.
 */
export type ElementType =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "path"
  | "media"
  | "text"
  | "note"
  | "group"

/**
 * Common fields shared by every canvas element. All elements extend this
 * interface.
 */
export interface BaseElement {
  id: ElementId
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  /**
   * Opacity from `0` (transparent) to `1` (opaque). Applies to the element's
   * stroke and fill as a whole. Defaults to `1` when omitted.
   */
  opacity?: number
}

/**
 * A rectangle element, optionally with rounded corners.
 */
export interface RectangleElement extends BaseElement {
  type: "rectangle"
  cornerRadius: number
  strokeWidth: number
  strokeColor: string
  /**
   * Fill color. Defaults to the `--adraw-fill` CSS variable (transparent)
   * when omitted; use `"none"` for no fill.
   */
  fillColor?: string
}

/**
 * An ellipse (or circle when width == height) element.
 */
export interface EllipseElement extends BaseElement {
  type: "ellipse"
  strokeWidth: number
  strokeColor: string
  /**
   * Fill color. Defaults to the `--adraw-fill` CSS variable (transparent)
   * when omitted; use `"none"` for no fill.
   */
  fillColor?: string
}

/**
 * A diamond (rhombus) element inscribed in its bounding box.
 */
export interface DiamondElement extends BaseElement {
  type: "diamond"
  strokeWidth: number
  strokeColor: string
  /**
   * Fill color. Defaults to the `--adraw-fill` CSS variable (transparent)
   * when omitted; use `"none"` for no fill.
   */
  fillColor?: string
}

/**
 * A straight line element defined by two endpoints.
 */
export interface LineElement extends BaseElement {
  type: "line"
  startX: number
  startY: number
  endX: number
  endY: number
  strokeWidth: number
  strokeColor: string
}

/**
 * A binding from one arrow endpoint to another element. `focus` is reserved
 * for a future attach point along the target's border; v1 always aims at the
 * target's center and clips at its border.
 */
export interface ArrowBinding {
  elementId: ElementId
  focus?: number
}

/**
 * A two-ended arrow element, optionally bound to other elements.
 */
export interface ArrowElement extends BaseElement {
  type: "arrow"
  startX: number
  startY: number
  endX: number
  endY: number
  strokeWidth: number
  strokeColor: string
  startArrowhead?: boolean
  endArrowhead?: boolean
  startBinding?: ArrowBinding | null
  endBinding?: ArrowBinding | null
}

/**
 * A freehand stroke made of sampled points. `smoothing` controls spline
 * tension used when rendering (default 0 = straight segments, 1 = full
 * Catmull-Rom curve). Falls back to {@link DEFAULT_PATH_SMOOTHING} when
 * omitted.
 */
export interface PathElement extends BaseElement {
  type: "path"
  points: Point[]
  strokeWidth: number
  strokeColor: string
  // Spline tension used when rendering the stroke (default = straight segments,
  // 1 = full Catmull-Rom curve). Falls back to DEFAULT_PATH_SMOOTHING when
  // omitted.
  smoothing?: number
}

/**
 * A raster image element placed on the canvas.
 */
export interface MediaElement extends BaseElement {
  type: "media"
  src: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
}

/**
 * A container element grouping other elements by id. Group `x`, `y`, `width`
 * and `height` are a derived bounding box kept in sync from the visible
 * descendants, and the group's own `rotation` stays `0`; the group itself is
 * not rendered. Moving, resizing or rotating a selected group transforms its
 * descendants.
 */
export interface GroupElement extends BaseElement {
  type: "group"
  children: ElementId[]
}

/**
 * Horizontal alignment of a text element's lines within its box.
 */
export type TextAlign = "left" | "center" | "right"

/**
 * A text element, either free or bound to a container.
 */
export interface TextElement extends BaseElement {
  type: "text"
  text: string
  fontSize: number
  strokeColor: string
  /**
   * Font family stack (e.g. `"system-ui, sans-serif"`). Defaults to the
   * built-in system font stack.
   */
  fontFamily?: string
  /**
   * Horizontal alignment of each line inside the element's box. Defaults to
   * `"left"`.
   */
  textAlign?: TextAlign
  /**
   * Unitless line height multiplier. The rendered line height is
   * `fontSize * lineHeight`. Defaults to `1.25`.
   */
  lineHeight?: number
  /**
   * When `true` (default) the box grows horizontally to fit the text and only
   * explicit `\n` characters create new lines. When `false` the text wraps at
   * the element's `width` and the box grows vertically.
   */
  autoSize?: boolean
  /**
   * Id of the rectangle, ellipse, diamond or arrow this text is bound to.
   * Bound text is centered inside the container, wraps to its inner width and
   * follows it when it moves, resizes or rotates.
   */
  containerId?: ElementId | null
  /**
   * Position of arrow-bound text along the arrow, from `0` (start) to `1`
   * (end). Defaults to `0.5`. Ignored for shape-bound text. The field name is
   * historical; it positions bound text.
   */
  labelPosition?: number | null
  /**
   * Wrap width for bound text. Bound text wraps at this width but keeps a box
   * as wide as its longest wrapped line (up to `wrapWidth`), so the inline
   * editor grows and shrinks horizontally with the content.
   */
  wrapWidth?: number | null
}

/**
 * A sticky note: a filled box with centered, wrapping text and a folded
 * bottom-right corner. Notes are created by the `note` tool and edited in
 * place by double-clicking them.
 */
export interface NoteElement extends BaseElement {
  type: "note"
  text: string
  fontSize: number
  /**
   * Ink color of the note's text.
   */
  strokeColor: string
  /**
   * Background color of the sticky note.
   */
  fillColor: string
  /** Font family stack. Defaults to the built-in system font stack. */
  fontFamily?: string
  /** Horizontal alignment of the text. Defaults to `"center"`. */
  textAlign?: TextAlign
  /** Unitless line height multiplier. Defaults to `1.25`. */
  lineHeight?: number
  /** Inner padding between the note border and its text, in pixels. */
  padding: number
  /** Corner radius of the note box, in pixels. */
  cornerRadius: number
}

/**
 * Elements with editable text content: free text and notes.
 */
export type EditableTextElement = TextElement | NoteElement

/**
 * Union of all concrete canvas element types.
 */
export type CanvasElement =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | LineElement
  | ArrowElement
  | PathElement
  | MediaElement
  | TextElement
  | NoteElement
  | GroupElement

/**
 * The active drawing/selecting tool on the canvas.
 */
export type ToolType =
  | "select"
  | "hand"
  | "draw"
  | "eraser"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "note"

/**
 * Viewport pan/zoom state.
 */
export interface ViewportState {
  x: number
  y: number
  zoom: number
}

/**
 * Canvas-wide configuration (snapping, grid, zoom limits).
 */
export interface CanvasConfig {
  snapEnabled: boolean
  snapThreshold: number
  gridEnabled: boolean
  gridSize: number
  minZoom: number
  maxZoom: number
}

/**
 * Optional visual styling shared by elements and tool options. Element
 * interfaces expose the concrete values: `strokeColor` and `strokeWidth` on
 * stroked shapes, `fillColor` on rectangles/ellipses/diamonds/notes, and
 * `opacity` on every element.
 */
export interface CanvasElementStyle {
  /** Stroke color. */
  strokeColor?: string
  /** Fill color. Applies to rectangles, ellipses, diamonds and notes. */
  fillColor?: string
  /** Stroke width in pixels. */
  strokeWidth?: number
  /** Opacity from `0` (transparent) to `1` (opaque). */
  opacity?: number
}

/**
 * Geometric transform applied to a selection.
 */
export interface Transform {
  translate: Point
  scale: Point
  rotation: number
}

/**
 * A visual alignment guide produced by snapping.
 */
export interface SnapGuide {
  type: "horizontal" | "vertical"
  position: number
  elements: ElementId[]
}

/**
 * Result of a snapping calculation.
 */
export interface SnapResult {
  guides: SnapGuide[]
  snapped: boolean
}

/**
 * Serializable canvas document format.
 */
export interface CanvasDocument {
  version: number
  elements: CanvasElement[]
}

/**
 * Anchor position used when resizing an element.
 */
export type ResizeAnchor =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "bottom-center"
  | "left-center"
  | "right-center"
  | "center"
