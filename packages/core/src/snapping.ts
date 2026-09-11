import type {
  CanvasElement,
  ElementId,
  Point,
  SnapGuide,
  SnapResult,
} from "./types"

export interface SnappingConfig {
  threshold: number
}

const DEFAULT_SNAPPING_CONFIG: SnappingConfig = {
  threshold: 5,
}

export function createSnappingConfig(
  partial: Partial<SnappingConfig> = {},
): SnappingConfig {
  return {
    ...DEFAULT_SNAPPING_CONFIG,
    ...partial,
  }
}

// Modifier keys that temporarily activate snapping when `isSnapMode` is off.
export interface SnapModifiers {
  ctrlKey: boolean
  metaKey: boolean
}

// Snapping is on when `isSnapMode` keeps it always on or the user holds
// Ctrl/Cmd for the duration of the gesture.
export function isSnapActive(
  isSnapMode: boolean,
  event: SnapModifiers,
): boolean {
  return isSnapMode || event.ctrlKey || event.metaKey
}

export interface SnapPoint {
  x: number
  y: number
  elementId: ElementId
  type: "left" | "right" | "top" | "bottom" | "center-x" | "center-y"
}

export function getElementSnapPoints(element: CanvasElement): SnapPoint[] {
  const { x, y, width, height } = element
  const cx = x + width / 2
  const cy = y + height / 2

  return [
    { elementId: element.id, type: "left", x, y },
    { elementId: element.id, type: "right", x: x + width, y },
    { elementId: element.id, type: "top", x, y },
    { elementId: element.id, type: "bottom", x, y: y + height },
    { elementId: element.id, type: "center-y", x: cx, y },
    { elementId: element.id, type: "center-x", x, y: cy },
  ]
}

export function getAllSnapPoints(
  elements: Map<ElementId, CanvasElement>,
  excludeIds = new Set<ElementId>(),
): SnapPoint[] {
  const snapPoints: SnapPoint[] = []

  for (const [id, element] of elements) {
    if (excludeIds.has(id) || !element.visible || element.locked) {
      continue
    }
    snapPoints.push(...getElementSnapPoints(element))
  }

  return snapPoints
}

export function calculateSnap(
  point: Point,
  snapPoints: SnapPoint[],
  threshold: number,
): SnapResult {
  const guides: SnapGuide[] = []
  let snapped = false

  for (const snapPoint of snapPoints) {
    const dx = Math.abs(point.x - snapPoint.x)
    const dy = Math.abs(point.y - snapPoint.y)

    if (dx < threshold) {
      guides.push({
        elements: [snapPoint.elementId],
        position: snapPoint.x,
        type: "vertical",
      })
      snapped = true
    }

    if (dy < threshold) {
      guides.push({
        elements: [snapPoint.elementId],
        position: snapPoint.y,
        type: "horizontal",
      })
      snapped = true
    }
  }

  return { guides, snapped }
}

export function snapPointToGuides(point: Point, guides: SnapGuide[]): Point {
  let snappedX = point.x
  let snappedY = point.y

  for (const guide of guides) {
    if (guide.type === "vertical") {
      snappedX = guide.position
    } else if (guide.type === "horizontal") {
      snappedY = guide.position
    }
  }

  return { x: snappedX, y: snappedY }
}

// A single axis feature of the moving bounds (its left/right/center or
// top/bottom/middle) paired with the offset needed to place the bounds so that
// feature lands on a guide position.
interface AxisFeature {
  offset: number
  position: number
}

interface AxisSnap {
  delta: number
  elementId: ElementId
  offset: number
  position: number
}

function nearestAxisSnap(
  features: AxisFeature[],
  snapPoints: SnapPoint[],
  axis: "x" | "y",
  threshold: number,
): AxisSnap | null {
  let best: AxisSnap | null = null

  for (const feature of features) {
    for (const snapPoint of snapPoints) {
      const position = snapPoint[axis]
      const delta = Math.abs(feature.position - position)

      if (delta < threshold && (!best || delta < best.delta)) {
        best = {
          delta,
          elementId: snapPoint.elementId,
          offset: feature.offset,
          position,
        }
      }
    }
  }

  return best
}

export function snapBoundsToElements(
  bounds: { x: number; y: number; width: number; height: number },
  elements: Map<ElementId, CanvasElement>,
  excludeIds: Set<ElementId>,
  threshold: number,
): {
  x: number
  y: number
  width: number
  height: number
  guides: SnapGuide[]
} {
  const snapPoints = getAllSnapPoints(elements, excludeIds)
  const guides: SnapGuide[] = []

  // Align the moving bounds' left/right/center with any target edge or center,
  // snapping the closest feature on each axis.
  const xSnap = nearestAxisSnap(
    [
      { offset: 0, position: bounds.x },
      { offset: -bounds.width, position: bounds.x + bounds.width },
      { offset: -bounds.width / 2, position: bounds.x + bounds.width / 2 },
    ],
    snapPoints,
    "x",
    threshold,
  )
  const ySnap = nearestAxisSnap(
    [
      { offset: 0, position: bounds.y },
      { offset: -bounds.height, position: bounds.y + bounds.height },
      { offset: -bounds.height / 2, position: bounds.y + bounds.height / 2 },
    ],
    snapPoints,
    "y",
    threshold,
  )

  if (xSnap) {
    guides.push({
      elements: [xSnap.elementId],
      position: xSnap.position,
      type: "vertical",
    })
  }
  if (ySnap) {
    guides.push({
      elements: [ySnap.elementId],
      position: ySnap.position,
      type: "horizontal",
    })
  }

  return {
    guides,
    height: bounds.height,
    width: bounds.width,
    x: xSnap ? xSnap.position + xSnap.offset : bounds.x,
    y: ySnap ? ySnap.position + ySnap.offset : bounds.y,
  }
}

// Snap a single point (a resize handle / drawing cursor) to the nearest target
// edge or center on each axis, returning the snapped point and its guides.
export function snapPointToElements(
  point: Point,
  elements: Map<ElementId, CanvasElement>,
  excludeIds: Set<ElementId>,
  threshold: number,
): { point: Point; guides: SnapGuide[] } {
  const snapPoints = getAllSnapPoints(elements, excludeIds)
  const guides: SnapGuide[] = []

  const xSnap = nearestAxisSnap(
    [{ offset: 0, position: point.x }],
    snapPoints,
    "x",
    threshold,
  )
  const ySnap = nearestAxisSnap(
    [{ offset: 0, position: point.y }],
    snapPoints,
    "y",
    threshold,
  )

  if (xSnap) {
    guides.push({
      elements: [xSnap.elementId],
      position: xSnap.position,
      type: "vertical",
    })
  }
  if (ySnap) {
    guides.push({
      elements: [ySnap.elementId],
      position: ySnap.position,
      type: "horizontal",
    })
  }

  return {
    guides,
    point: {
      x: xSnap ? xSnap.position : point.x,
      y: ySnap ? ySnap.position : point.y,
    },
  }
}
