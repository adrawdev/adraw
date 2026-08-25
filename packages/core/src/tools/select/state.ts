import type { BoundingBox, CanvasElement, ElementId, Point } from "../../types"

export interface OriginalPosition {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  points?: Point[]
  lineStart?: Point
  lineEnd?: Point
}

export interface SelectToolState {
  isActive: boolean
  startPoint: Point | null
  currentPoint: Point | null
  dragStartElement: CanvasElement | null
  dragStartPoint: Point | null
  originalPositions: Map<ElementId, OriginalPosition>
  dragHandle: string | null
  rotationCenter: Point | null
  originalBounds: BoundingBox | null
  // Marquee (rubber-band) selection: the anchor point where the brush started,
  // the current box while dragging, and the selection captured at brush start so
  // a multi-select modifier can union the brushed elements onto it.
  brushStart: Point | null
  brushBox: BoundingBox | null
  brushBaseSelection: Set<ElementId> | null
}

export function createSelectToolState(): SelectToolState {
  return {
    brushBaseSelection: null,
    brushBox: null,
    brushStart: null,
    currentPoint: null,
    dragHandle: null,
    dragStartElement: null,
    dragStartPoint: null,
    isActive: false,
    originalBounds: null,
    originalPositions: new Map(),
    rotationCenter: null,
    startPoint: null,
  }
}

export function getPointsBounds(points: Point[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY }
}

// Axis-aligned bounding-box overlap test. The marquee selects any element whose
// bounding box it touches (intersection semantics), so rotation is approximated
// by the element's unrotated box — good enough for a rubber-band selection.
export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  )
}

// Which sides of the selection box a `data-anchor` handle drags. Used to keep
// the corner/edge opposite the dragged handle fixed during a resize.
export function getResizeAxes(handle: string): {
  changesHeight: boolean
  changesWidth: boolean
  movesLeft: boolean
  movesTop: boolean
} {
  const movesLeft =
    handle === "top-left" ||
    handle === "bottom-left" ||
    handle === "left-center"
  const movesTop =
    handle === "top-left" || handle === "top-right" || handle === "top-center"
  const changesWidth = handle !== "top-center" && handle !== "bottom-center"
  const changesHeight = handle !== "left-center" && handle !== "right-center"
  return { changesHeight, changesWidth, movesLeft, movesTop }
}

export function constrainResizeDimensions(
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
  changesWidth: boolean,
  changesHeight: boolean,
): { height: number; width: number } {
  if (changesWidth && changesHeight) {
    const scale = Math.max(
      Math.abs(width) / originalWidth,
      Math.abs(height) / originalHeight,
    )
    return {
      height: (Math.sign(height) || 1) * originalHeight * scale,
      width: (Math.sign(width) || 1) * originalWidth * scale,
    }
  }

  if (changesWidth) {
    return {
      height: originalHeight * (Math.abs(width) / originalWidth),
      width,
    }
  }

  if (changesHeight) {
    return {
      height,
      width: originalWidth * (Math.abs(height) / originalHeight),
    }
  }

  return { height, width }
}
