import { FILL_COLOR, STROKE_COLOR, STROKE_WIDTH } from "../constants"
import type { SnappingConfig } from "../snapping"
import type { StyleOptions } from "../style"
import type { TextMeasurer } from "../text"
import type {
  BoundingBox,
  CanvasElement,
  CanvasElementStyle,
  ElementId,
  Point,
  SnapGuide,
  ToolType,
  ViewportState,
} from "../types"

/**
 * Read/write access a tool has to the canvas state. Tools never mutate state
 * directly; they go through these helpers.
 */
export interface ToolContext {
  getElements: () => Map<ElementId, CanvasElement>
  setElements: (elements: Map<ElementId, CanvasElement>) => void
  getSelectedIds: () => Set<ElementId>
  setSelectedIds: (ids: Set<ElementId>) => void
  getViewport: () => ViewportState
  setViewport: (viewport: ViewportState) => void
  getCanvasSize: () => { width: number; height: number }
  /**
   * Global style overrides set with `setStyle`. Engines provide this so style
   * changes apply to future gestures without recreating the tool; standalone
   * tool factories may omit it and fall back to their factory options.
   */
  getStyle?: () => StyleOptions
  /**
   * Text measurer configured on the engine. Text-like tools use it to size
   * their elements; standalone tool factories may omit it and fall back to the
   * built-in approximation.
   */
  measureText?: TextMeasurer
  getSnappingConfig: () => SnappingConfig
  getIsSnapMode: () => boolean
  setSnapGuides: (guides: SnapGuide[]) => void
  pushHistory: () => void
  /**
   * Complete a successful creation gesture. The engine switches back to the
   * selection tool unless it is configured to keep the active tool
   * (`isToolLocked`). Optional so standalone tool factories can
   * keep using `setActiveTool("select")`.
   */
  finishCreation?: () => void
  setActiveTool: (tool: ToolType) => void
}

/**
 * Base state shared by every tool gesture.
 */
export interface ToolState {
  isActive: boolean
  startPoint: Point | null
  currentPoint: Point | null
}

/**
 * Contract implemented by each drawing/selecting tool.
 */
export interface Tool {
  /** Tool identifier. */
  readonly type: ToolType
  /** CSS cursor to show while the tool is active. */
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
  /** Transient element rendered during a gesture. */
  getTemporaryElement: () => CanvasElement | null
  /** Element currently highlighted as a binding candidate, or null. Only arrow/select implement this. */
  getBindingCandidate?: () => ElementId | null
  /** In-progress marquee (rubber-band) selection box in canvas space. */
  getSelectionBox?: () => BoundingBox | null
  /** Whether the tool is actively resizing the selection. */
  isResizing?: () => boolean
  /** Whether the tool is actively rotating the selection. */
  isRotating?: () => boolean
}

/**
 * Create a fresh base tool state.
 */
export function createBaseToolState(): ToolState {
  return {
    currentPoint: null,
    isActive: false,
    startPoint: null,
  }
}

/**
 * Default style options derived from the global constants.
 */
export function getDefaultToolOptions(): CanvasElementStyle {
  return {
    fillColor: FILL_COLOR,
    opacity: 1,
    strokeColor: STROKE_COLOR,
    strokeWidth: STROKE_WIDTH,
  }
}

/**
 * Merge a tool's factory options with the live global style supplied by the
 * engine. Engines provide `getStyle()`; standalone tools fall back to their
 * factory defaults.
 *
 * @param defaults Options captured when the tool was created.
 * @param context Current tool context.
 * @returns The effective options for the gesture about to start.
 */
export function getStyleForContext<T extends CanvasElementStyle>(
  defaults: T,
  context: ToolContext,
): T {
  return { ...defaults, ...context.getStyle?.() } as T
}

/**
 * Finish a creation gesture: return to the selection tool, or keep the current
 * tool when the engine is configured to keep it active. Tools call this after
 * committing the element they created.
 *
 * @param context Current tool context.
 */
export function finishCreationGesture(context: ToolContext): void {
  if (context.finishCreation) {
    context.finishCreation()
    return
  }
  context.setActiveTool("select")
}

/**
 * Compute the axis-aligned bounds between two points (top-left origin).
 */
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

/**
 * Bounds with signed extents (negative when the drag crosses `startPoint`).
 * Resize uses signed extents to mirror across anchors; creation uses the
 * positive width/height and x/y.
 */
export interface ShapeBounds extends BoundingBox {
  /** Signed width (may be negative). */
  signedHeight: number
  /** Signed height (may be negative). */
  signedWidth: number
}

/**
 * Options for {@link calculateShapeBounds}.
 */
export interface ShapeBoundsOptions {
  /** Box being transformed. */
  base?: BoundingBox
  /** Which axes the pointer drives. */
  changes?: { height: boolean; width: boolean }
  /** Preserve `base` proportions while dragging. */
  constrainProportions?: boolean
  /** Drag direction multiplier per axis. */
  direction?: Point
  /** Treat `startPoint` as the center rather than a corner. */
  fromCenter?: boolean
}

/**
 * Compute bounds produced by dragging from `startPoint` to `endPoint`, shared
 * by shape creation and selection resize.
 *
 * @param startPoint Drag start point.
 * @param endPoint Current pointer point.
 * @param options Geometry modifiers.
 * @returns Bounds plus signed extents.
 * @example
 * ```ts
 * const bounds = calculateShapeBounds(start, end, { fromCenter: true })
 * ```
 */
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

/**
 * Midpoint between two points.
 */
export function getCenterPoint(startPoint: Point, endPoint: Point): Point {
  return {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  }
}
