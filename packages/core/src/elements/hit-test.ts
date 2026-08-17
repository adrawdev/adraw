import type { CanvasElement, ElementId, LineElement, Point } from "../types"

export function getElementsBounds(
  elements: Map<ElementId, CanvasElement>,
  ids?: Set<ElementId>,
): {
  left: number
  right: number
  top: number
  bottom: number
  x: number
  y: number
  width: number
  height: number
} | null {
  let elementArray = [...elements.values()].filter((el) => el.visible)
  if (ids) {
    elementArray = elementArray.filter((el) => ids.has(el.id))
  }

  if (elementArray.length === 0) {
    return null
  }

  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity

  for (const element of elementArray) {
    left = Math.min(left, element.x)
    right = Math.max(right, element.x + element.width)
    top = Math.min(top, element.y)
    bottom = Math.max(bottom, element.y + element.height)
  }

  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
    x: left,
    y: top,
  }
}

export function getElementAtPoint(
  elements: Map<ElementId, CanvasElement>,
  point: Point,
): CanvasElement | null {
  const elementArray = [...elements.values()]
    .filter((el) => el.visible && !el.locked)
    .toSorted((a, b) => b.zIndex - a.zIndex)

  for (const element of elementArray) {
    if (isPointInElement(point, element)) {
      return element
    }
  }

  return null
}

function pointToSegmentDistance(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }
  let t = ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const closest = { x: a.x + t * abx, y: a.y + t * aby }
  return Math.hypot(point.x - closest.x, point.y - closest.y)
}

function isPointInElement(point: Point, element: CanvasElement): boolean {
  const { x, y, width, height, rotation, type } = element

  if (type === "line") {
    const line = element as LineElement
    const halfStroke = Math.max(line.strokeWidth, 4) / 2
    if (rotation === 0) {
      return (
        pointToSegmentDistance(
          point,
          { x: line.startX, y: line.startY },
          { x: line.endX, y: line.endY },
        ) <=
        halfStroke + 2
      )
    }
    const cx = x + width / 2
    const cy = y + height / 2
    const rad = (-rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = point.x - cx
    const dy = point.y - cy
    const rx = cos * dx - sin * dy
    const ry = sin * dx + cos * dy
    const unrotated = { x: rx + cx, y: ry + cy }
    return (
      pointToSegmentDistance(
        unrotated,
        { x: line.startX, y: line.startY },
        { x: line.endX, y: line.endY },
      ) <=
      halfStroke + 2
    )
  }

  if (rotation === 0) {
    return (
      point.x >= x &&
      point.x <= x + width &&
      point.y >= y &&
      point.y <= y + height
    )
  }

  const cx = x + width / 2
  const cy = y + height / 2
  const rad = (-rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const dx = point.x - cx
  const dy = point.y - cy

  const rx = cos * dx - sin * dy
  const ry = sin * dx + cos * dy

  return (
    rx >= -width / 2 && rx <= width / 2 && ry >= -height / 2 && ry <= height / 2
  )
}
