export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export type ElementId = string

export type ElementType =
  | "rectangle"
  | "ellipse"
  | "star"
  | "line"
  | "arrow"
  | "path"
  | "media"
  | "text"
  | "group"

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
}

export interface RectangleElement extends BaseElement {
  type: "rectangle"
  cornerRadius: number
  strokeWidth: number
  strokeColor: string
}

export interface EllipseElement extends BaseElement {
  type: "ellipse"
  strokeWidth: number
  strokeColor: string
}

export interface LineElement extends BaseElement {
  type: "line"
  startX: number
  startY: number
  endX: number
  endY: number
  strokeWidth: number
  strokeColor: string
}

// A live link from one arrow endpoint to another element. `focus` is reserved
// for a future attach point along the target's border; v1 always aims at the
// target's center and clips at its border.
export interface ArrowBinding {
  elementId: ElementId
  focus?: number
}

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

export interface MediaElement extends BaseElement {
  type: "media"
  src: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
}

export interface GroupElement extends BaseElement {
  type: "group"
  children: ElementId[]
}

export interface TextElement extends BaseElement {
  type: "text"
  text: string
  fontSize: number
  strokeColor: string
}

export type CanvasElement =
  | RectangleElement
  | EllipseElement
  | LineElement
  | ArrowElement
  | PathElement
  | MediaElement
  | TextElement
  | GroupElement

export type ToolType =
  | "select"
  | "hand"
  | "draw"
  | "eraser"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"

export interface ViewportState {
  x: number
  y: number
  zoom: number
}

export interface CanvasConfig {
  snapEnabled: boolean
  snapThreshold: number
  gridEnabled: boolean
  gridSize: number
  minZoom: number
  maxZoom: number
}

export interface CanvasState {
  elements: Map<ElementId, CanvasElement>
  selectedIds: Set<ElementId>
  viewport: ViewportState
  activeTool: ToolType
}

export interface CanvasElementStyle {
  strokeColor?: string
  fillColor?: string
  strokeWidth?: number
  opacity?: number
}

export interface Transform {
  translate: Point
  scale: Point
  rotation: number
}

export interface SnapGuide {
  type: "horizontal" | "vertical"
  position: number
  elements: ElementId[]
}

export interface SnapResult {
  guides: SnapGuide[]
  snapped: boolean
}

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
