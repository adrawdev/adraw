import { STROKE_COLOR, STROKE_WIDTH } from "../../constants"
import {
  createPath,
  DEFAULT_PATH_SMOOTHING,
  type ElementFactory,
} from "../../elements"
import type { PathElement, Point } from "../../types"
import type { ToolOptions } from "../base"

export interface DrawToolOptions extends ToolOptions {
  smoothing?: number
}

function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2,
    )
  }

  const t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
    (dx * dx + dy * dy)

  const nearestX = lineStart.x + t * dx
  const nearestY = lineStart.y + t * dy

  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2)
}

function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points
  }

  const first = points[0]
  const last = points[points.length - 1]

  let maxDistance = 0
  let maxIndex = 0

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last)
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPath(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  }

  return [first, last]
}

function getPathBounds(points: Point[]): {
  x: number
  y: number
  width: number
  height: number
} | null {
  if (points.length === 0) {
    return null
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY,
  }
}

export function createPathElement(
  points: Point[],
  {
    smoothing = DEFAULT_PATH_SMOOTHING,
    strokeColor = STROKE_COLOR,
    strokeWidth = STROKE_WIDTH,
  }: DrawToolOptions,
  factory?: Partial<ElementFactory<PathElement>>,
) {
  const simplifiedPoints = simplifyPath(points, 1 - smoothing)
  const bounds = getPathBounds(simplifiedPoints)

  if (!bounds) {
    return null
  }

  return createPath({
    height: Math.max(bounds.height, 1),
    locked: false,
    points: simplifiedPoints,
    rotation: 0,
    smoothing,
    strokeColor,
    strokeWidth,
    visible: true,
    width: Math.max(bounds.width, 1),
    x: bounds.x,
    y: bounds.y,
    zIndex: 0,
    ...factory,
  })
}
