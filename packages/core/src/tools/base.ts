import { FILL_COLOR, STROKE_COLOR, STROKE_WIDTH } from "../constants"
import type {
  BoundingBox,
  CanvasElement,
  ElementId,
  Point,
  ToolType,
  ViewportState,
} from "../types"

export interface ToolContext {
  getElements: () => Map<ElementId, CanvasElement>
  setElements: (elements: Map<ElementId, CanvasElement>) => void
  getSelectedIds: () => Set<ElementId>
  setSelectedIds: (ids: Set<ElementId>) => void
  getViewport: () => ViewportState
  setViewport: (viewport: ViewportState) => void
  getCanvasSize: () => { width: number; height: number }
  getStrokeColor: () => string
  pushHistory: () => void
  setActiveTool: (tool: ToolType) => void
}

export interface ToolState {
  isActive: boolean
  startPoint: Point | null
  currentPoint: Point | null
}

export interface Tool {
  readonly type: ToolType
  readonly cursor: string
  onActivate: (context: ToolContext) => void
  onDeactivate: (context: ToolContext) => void
  onPointerDown: (
    context: ToolContext,
    point: Point,
    event: PointerEvent,
  ) => void
  onPointerMove: (
    context: ToolContext,
    point: Point,
    event: PointerEvent,
  ) => void
  onPointerUp: (context: ToolContext, point: Point, event: PointerEvent) => void
  getTemporaryElement: () => CanvasElement | null
  // In-progress marquee (rubber-band) selection box in canvas space, or null
  // when the tool isn't brushing. Rendered as a dashed overlay, not committed as
  // an element. Only the select tool implements this.
  getSelectionBox?: () => BoundingBox | null
  // True while the tool is actively resizing the selection. The transform
  // overlay (bounding box + handles) is hidden during the gesture so it
  // doesn't visually lag the element being transformed. Only the select tool
  // implements this.
  isResizing?: () => boolean
  // True while the tool is actively rotating the selection. Only the select
  // tool implements this.
  isRotating?: () => boolean
}

export function createBaseToolState(): ToolState {
  return {
    currentPoint: null,
    isActive: false,
    startPoint: null,
  }
}

export interface ToolOptions {
  strokeColor?: string
  fillColor?: string
  strokeWidth?: number
}

export function getDefaultToolOptions(): ToolOptions {
  return {
    fillColor: FILL_COLOR,
    strokeColor: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
  }
}

export function calculateBounds(
  startPoint: Point,
  endPoint: Point,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(startPoint.x, endPoint.x)
  const y = Math.min(startPoint.y, endPoint.y)
  const width = Math.abs(endPoint.x - startPoint.x)
  const height = Math.abs(endPoint.y - startPoint.y)

  return { height, width, x, y }
}

export interface ShapeBounds extends BoundingBox {
  // Signed extents, negative when the drag crosses `startPoint`. Resize callers
  // use these to mirror elements across the fixed anchor; shape creation uses
  // the positive `width`/`height` and `x`/`y`.
  signedHeight: number
  signedWidth: number
}

export interface ShapeBoundsOptions {
  // Box being transformed. Needed by resize: its proportions seed the
  // constrained drag (default 1:1, i.e. square) and its position/extent fill
  // in the axes the drag doesn't change.
  base?: BoundingBox
  // Which axes the pointer drives; the others keep `base`'s extent.
  changes?: { height: boolean; width: boolean }
  // Preserve `base`'s proportions while dragging instead of sizing each axis
  // independently.
  constrainProportions?: boolean
  // Sign of the drag along each axis: -1 for resize handles that grow toward
  // negative coordinates (left/top), 1 otherwise. Defaults to an unoriented
  // drag, as used by shape creation.
  direction?: Point
  // Treat `startPoint` as the center of the result rather than a corner.
  fromCenter?: boolean
}

// Bounds produced by dragging from `startPoint` to `endPoint`, shared by shape
// creation and selection resize. `constrainProportions` keeps `base`'s
// proportions (default 1:1, i.e. a square) and `fromCenter` treats the start
// point as the center; resize callers also pass the driven axes and handle
// direction so the returned signed extents flip content across the anchor.
export function calculateShapeBounds(
  startPoint: Point,
  endPoint: Point,
  options: ShapeBoundsOptions = {},
): ShapeBounds {
  const {
    base,
    changes = { height: true, width: true },
    constrainProportions = false,
    direction = { x: 1, y: 1 },
    fromCenter = false,
  } = options

  const baseWidth = base?.width ?? 1
  const baseHeight = base?.height ?? 1

  let signedWidth = changes.width
    ? direction.x * (fromCenter ? 2 : 1) * (endPoint.x - startPoint.x)
    : baseWidth
  let signedHeight = changes.height
    ? direction.y * (fromCenter ? 2 : 1) * (endPoint.y - startPoint.y)
    : baseHeight

  if (constrainProportions) {
    if (changes.width && changes.height) {
      const scale = Math.max(
        Math.abs(signedWidth) / baseWidth,
        Math.abs(signedHeight) / baseHeight,
      )
      signedWidth = (Math.sign(signedWidth) || 1) * baseWidth * scale
      signedHeight = (Math.sign(signedHeight) || 1) * baseHeight * scale
    } else if (changes.width) {
      signedHeight = baseHeight * (Math.abs(signedWidth) / baseWidth)
    } else if (changes.height) {
      signedWidth = baseWidth * (Math.abs(signedHeight) / baseHeight)
    }
  }

  const width = Math.abs(signedWidth)
  const height = Math.abs(signedHeight)

  const x = changes.width
    ? fromCenter
      ? startPoint.x - width / 2
      : Math.min(startPoint.x, startPoint.x + signedWidth)
    : (base?.x ?? startPoint.x) + ((base?.width ?? 0) - width) / 2
  const y = changes.height
    ? fromCenter
      ? startPoint.y - height / 2
      : Math.min(startPoint.y, startPoint.y + signedHeight)
    : (base?.y ?? startPoint.y) + ((base?.height ?? 0) - height) / 2

  return { height, signedHeight, signedWidth, width, x, y }
}

export function getCenterPoint(startPoint: Point, endPoint: Point): Point {
  return {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  }
}
