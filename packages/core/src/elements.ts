import { generateId } from "./coordinates"
import type {
  CanvasElement,
  ElementId,
  EllipseElement,
  GroupElement,
  LineElement,
  MediaElement,
  PathElement,
  Point,
  RectangleElement,
  ResizeAnchor,
  Size,
  TextElement,
} from "./types"

export type ElementFactory<T extends CanvasElement> = Omit<T, "id" | "type"> & {
  id?: string
}

// Default spline tension for freehand paths (0 = straight segments, 1 = full
// Catmull-Rom curve). Shared by the draw tool and the renderer so a path always
// looks the same regardless of how it was constructed.
export const DEFAULT_PATH_SMOOTHING = 0.5

export function createRectangle(
  factory: ElementFactory<RectangleElement>,
): RectangleElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "rectangle",
  }
}

export function createEllipse(
  factory: ElementFactory<EllipseElement>,
): EllipseElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "ellipse",
  }
}

export function createLine(factory: ElementFactory<LineElement>): LineElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "line",
  }
}

export function createPath(factory: ElementFactory<PathElement>): PathElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    points: factory.points ?? [],
    smoothing: factory.smoothing ?? DEFAULT_PATH_SMOOTHING,
    type: "path",
  }
}

export function createMedia(
  factory: ElementFactory<MediaElement>,
): MediaElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "media",
  }
}

export function createText(factory: ElementFactory<TextElement>): TextElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "text",
  }
}

// Approximate the rendered size of a text element without a DOM: ~0.6em per
// character on the longest line, 1.2em line height. The DOM adapter renders
// text with the same metrics so the bounding box stays close to the glyphs.
export function measureTextSize(text: string, fontSize: number): Size {
  const lines = text.split("\n")
  const lineHeight = fontSize * 1.2
  let width = 0
  for (const line of lines) {
    width = Math.max(width, line.length * fontSize * 0.6)
  }
  return {
    height: Math.max(lineHeight, lines.length * lineHeight),
    width: Math.max(1, width),
  }
}

export function createGroup(
  factory: ElementFactory<GroupElement>,
): GroupElement {
  return {
    ...factory,
    children: factory.children ?? [],
    id: factory.id ?? generateId(),
    type: "group",
  }
}

export function cloneElement<T extends CanvasElement>(
  element: T,
  offset: Point = { x: 20, y: 20 },
): T {
  return {
    ...element,
    id: generateId(),
    x: element.x + offset.x,
    y: element.y + offset.y,
  }
}

export function moveElement(
  element: CanvasElement,
  delta: Point,
): CanvasElement {
  return {
    ...element,
    x: element.x + delta.x,
    y: element.y + delta.y,
  }
}

export function resizeElement(
  element: CanvasElement,
  width: number,
  height: number,
  anchor: ResizeAnchor = "top-left",
): CanvasElement {
  let { x, y } = element

  switch (anchor) {
    case "top-right": {
      x = element.x + element.width - width
      break
    }
    case "bottom-left": {
      y = element.y + element.height - height
      break
    }
    case "bottom-right": {
      x = element.x + element.width - width
      y = element.y + element.height - height
      break
    }
    case "top-center": {
      x = element.x + (element.width - width) / 2
      break
    }
    case "bottom-center": {
      x = element.x + (element.width - width) / 2
      y = element.y + element.height - height
      break
    }
    case "left-center": {
      y = element.y + (element.height - height) / 2
      break
    }
    case "right-center": {
      x = element.x + element.width - width
      y = element.y + (element.height - height) / 2
      break
    }
    case "center": {
      x = element.x + (element.width - width) / 2
      y = element.y + (element.height - height) / 2
      break
    }
  }

  return {
    ...element,
    height: Math.max(1, height),
    width: Math.max(1, width),
    x,
    y,
  }
}

export function rotateElement(
  element: CanvasElement,
  rotation: number,
): CanvasElement {
  return {
    ...element,
    rotation: rotation % 360,
  }
}

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
