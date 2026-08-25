import { generateId } from "./coordinates"
import type {
  CanvasElement,
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

export { getElementAtPoint, getElementsBounds } from "./elements/hit-test"

export type ElementFactory<T extends CanvasElement> = Omit<T, "id" | "type"> & {
  id?: string
}

export function getNextZIndex(elements: Iterable<CanvasElement>): number {
  let maxZIndex = 0
  for (const element of elements) {
    maxZIndex = Math.max(maxZIndex, element.zIndex)
  }
  return maxZIndex + 1
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
