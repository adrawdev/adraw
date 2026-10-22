import { generateId } from "./coordinates"
import { measureTextLayout, type TextLayoutOptions } from "./text"
import type {
  ArrowElement,
  CanvasElement,
  EllipseElement,
  GroupElement,
  LineElement,
  MediaElement,
  NoteElement,
  PathElement,
  Point,
  RectangleElement,
  ResizeAnchor,
  Size,
  TextElement,
} from "./types"

export { getElementAtPoint, getElementsBounds } from "./elements/hit-test"

/**
 * Partial factory input used by the element creation helpers: every field of
 * the element except `id` and `type`, with `id` allowed to be supplied.
 */
export type ElementFactory<T extends CanvasElement> = Omit<T, "id" | "type"> & {
  id?: string
}

/**
 * Get the next z-index value above all elements in `elements`.
 */
export function getNextZIndex(elements: Iterable<CanvasElement>): number {
  let maxZIndex = 0
  for (const element of elements) {
    maxZIndex = Math.max(maxZIndex, element.zIndex)
  }
  return maxZIndex + 1
}

/**
 * Default spline tension for freehand paths (0 = straight segments, 1 = full
 * Catmull-Rom curve). Shared by the draw tool and the renderer.
 */
export const DEFAULT_PATH_SMOOTHING = 0.5

/**
 * Create a rectangle element.
 * @example
 * ```ts
 * const el = createRectangle({ x: 0, y: 0, width: 100, height: 50, cornerRadius: 4, strokeWidth: 2 })
 * ```
 */
export function createRectangle(
  factory: ElementFactory<RectangleElement>,
): RectangleElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "rectangle",
  }
}

/**
 * Create an ellipse element.
 */
export function createEllipse(
  factory: ElementFactory<EllipseElement>,
): EllipseElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "ellipse",
  }
}

/**
 * Create a line element.
 */
export function createLine(factory: ElementFactory<LineElement>): LineElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "line",
  }
}

/**
 * Create an arrow element.
 */
export function createArrow(
  factory: ElementFactory<ArrowElement>,
): ArrowElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "arrow",
  }
}

/**
 * Create a freehand path element. Points defaults to `[]` and smoothing to
 * {@link DEFAULT_PATH_SMOOTHING}.
 */
export function createPath(factory: ElementFactory<PathElement>): PathElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    points: factory.points ?? [],
    smoothing: factory.smoothing ?? DEFAULT_PATH_SMOOTHING,
    type: "path",
  }
}

/**
 * Create a media (image) element.
 */
export function createMedia(
  factory: ElementFactory<MediaElement>,
): MediaElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "media",
  }
}

/**
 * Create a text element.
 */
export function createText(factory: ElementFactory<TextElement>): TextElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "text",
  }
}

/**
 * Create a sticky note element.
 */
export function createNote(factory: ElementFactory<NoteElement>): NoteElement {
  return {
    ...factory,
    id: factory.id ?? generateId(),
    type: "note",
  }
}

/**
 * Approximate the rendered size of a text element without a DOM. Uses
 * ~0.6em per character and the default line height; pass layout options to
 * measure a different font or wrapping mode.
 *
 * @param text Text content.
 * @param fontSize Font size in pixels.
 * @param options Optional font family, line height and wrapping options.
 * @returns Approximate width/height.
 */
export function measureTextSize(
  text: string,
  fontSize: number,
  options: Omit<TextLayoutOptions, "fontSize"> = {},
): Size {
  const layout = measureTextLayout(text, { ...options, fontSize })
  return { height: layout.height, width: layout.width }
}

/**
 * Create a group element grouping other element ids.
 */
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

/**
 * Clone an element with a new id and offset position (default offset 20,20).
 *
 * @param element Element to clone.
 * @param offset Offset applied to x/y. Defaults to `{ x: 20, y: 20 }`.
 * @returns A new element with a fresh id.
 */
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

/**
 * Move an element by a delta, returning a new element.
 */
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

/**
 * Resize an element to the given dimensions, keeping the requested anchor
 * (default `top-left`) fixed.
 *
 * @param element Element to resize.
 * @param width New width (clamped to at least 1).
 * @param height New height (clamped to at least 1).
 * @param anchor Anchor kept fixed while resizing.
 * @returns A new element with updated geometry.
 */
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

/**
 * Rotate an element to the given rotation (mod 360).
 */
export function rotateElement(
  element: CanvasElement,
  rotation: number,
): CanvasElement {
  return {
    ...element,
    rotation: rotation % 360,
  }
}
