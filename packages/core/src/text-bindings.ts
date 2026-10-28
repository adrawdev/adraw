import { BOUND_TEXT_PADDING } from "./constants"
import { measureTextElement, type TextMeasurer } from "./text"
import type {
  ArrowElement,
  BoundingBox,
  CanvasElement,
  DiamondElement,
  EllipseElement,
  ElementId,
  RectangleElement,
  TextElement,
} from "./types"

/**
 * Elements that can own bound text.
 */
export type BoundTextContainer =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | ArrowElement

const TEXT_PADDING = BOUND_TEXT_PADDING * 2

/**
 * Whether an element can own bound text.
 *
 * @param element Element to check.
 * @returns `true` for rectangles, ellipses, diamonds and arrows.
 */
export function isBoundTextContainer(
  element: CanvasElement | null | undefined,
): element is BoundTextContainer {
  return (
    element?.type === "rectangle" ||
    element?.type === "ellipse" ||
    element?.type === "diamond" ||
    element?.type === "arrow"
  )
}

/**
 * Find the bound text owned by a container.
 *
 * @param elements Current element map.
 * @param containerId Container id.
 * @returns The bound text element, or `undefined`.
 */
export function findBoundText(
  elements: ReadonlyMap<ElementId, CanvasElement>,
  containerId: ElementId,
): TextElement | undefined {
  for (const element of elements.values()) {
    if (element.type === "text" && element.containerId === containerId) {
      return element
    }
  }
  return undefined
}

/**
 * Bounding box of the text bound to a container, or `null` when it has none.
 * Used by the arrow renderer to leave a gap in the shaft under its bound text.
 *
 * @param elements Current element map.
 * @param containerId Container id.
 * @returns The bound-text bounds, or `null`.
 */
export function getBoundTextBounds(
  elements: ReadonlyMap<ElementId, CanvasElement>,
  containerId: ElementId,
): BoundingBox | null {
  const boundText = findBoundText(elements, containerId)
  if (!boundText || !boundText.visible) {
    return null
  }
  return {
    height: boundText.height,
    width: boundText.width,
    x: boundText.x,
    y: boundText.y,
  }
}

/**
 * Maximum text width inside a container, in pixels. Arrows use a fraction of
 * their length; ellipses and diamonds use the largest rectangle inscribed in
 * the shape.
 *
 * @param container Bound-text container.
 * @param fontSize Font size used for the arrow minimum width.
 * @returns Wrap width in pixels.
 */
export function getBoundTextMaxWidth(
  container: BoundTextContainer,
  fontSize: number,
): number {
  if (container.type === "arrow") {
    const length = Math.hypot(
      container.endX - container.startX,
      container.endY - container.startY,
    )
    return Math.max(1, fontSize * 11, length * 0.7)
  }
  if (container.type === "ellipse") {
    return Math.max(
      1,
      Math.round((container.width / 2) * Math.SQRT2) - TEXT_PADDING,
    )
  }
  if (container.type === "diamond") {
    return Math.max(1, Math.round(container.width / 2) - TEXT_PADDING)
  }
  return Math.max(1, container.width - TEXT_PADDING)
}

/**
 * Maximum text height inside a container, in pixels. Arrows are unbounded.
 *
 * @param container Bound-text container.
 * @returns Available height in pixels.
 */
export function getBoundTextMaxHeight(container: BoundTextContainer): number {
  if (container.type === "arrow") {
    return Number.POSITIVE_INFINITY
  }
  if (container.type === "ellipse") {
    return Math.max(
      1,
      Math.round((container.height / 2) * Math.SQRT2) - TEXT_PADDING,
    )
  }
  if (container.type === "diamond") {
    return Math.max(1, Math.round(container.height / 2) - TEXT_PADDING)
  }
  return Math.max(1, container.height - TEXT_PADDING)
}

function clampLabelPosition(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0.5
  }
  return Math.min(1, Math.max(0, value))
}

/**
 * Center and rotation a bound text should have. Shape-bound text inherits the
 * container's rotation; arrow-bound text sits on the line at `labelPosition`.
 *
 * @param container Bound-text container.
 * @param labelPosition Arrow position (0–1).
 * @returns Center point and rotation.
 */
export function getBoundTextCenter(
  container: BoundTextContainer,
  labelPosition?: number | null,
): { x: number; y: number; rotation: number } {
  if (container.type === "arrow") {
    const t = clampLabelPosition(labelPosition)
    return {
      rotation: 0,
      x: container.startX + (container.endX - container.startX) * t,
      y: container.startY + (container.endY - container.startY) * t,
    }
  }
  return {
    rotation: container.rotation,
    x: container.x + container.width / 2,
    y: container.y + container.height / 2,
  }
}

// Grow a shape vertically when its bound text no longer fits. Arrow-bound text
// never grows its container. Excalidraw uses the inscribed-rectangle ratio for
// ellipses so the text stays inside the curve.
function growBoundTextContainer(
  container: BoundTextContainer,
  textHeight: number,
): BoundTextContainer | null {
  if (container.type === "arrow") {
    return null
  }
  if (textHeight <= getBoundTextMaxHeight(container)) {
    return null
  }
  const height =
    container.type === "ellipse"
      ? Math.round(((textHeight + TEXT_PADDING) / Math.SQRT2) * 2)
      : container.type === "diamond"
        ? Math.round((textHeight + TEXT_PADDING) * 2)
        : Math.ceil(textHeight + TEXT_PADDING)
  if (height <= container.height) {
    return null
  }
  return { ...container, height }
}

/**
 * Re-wrap, center and grow every bound text element so it fits its container.
 * Removes bound text whose container no longer exists. Repositioning is skipped
 * when the width and geometry already match, so this is cheap enough to run on
 * every tool update.
 *
 * @param elements Element map to mutate in place.
 * @param measurer Text measurer used for wrapping.
 * @returns `true` when the map changed.
 */
export function syncTextBindings(
  elements: Map<ElementId, CanvasElement>,
  measurer: TextMeasurer,
): boolean {
  let changed = false
  const removals: ElementId[] = []
  const texts = [...elements.values()].filter(
    (element): element is TextElement =>
      element.type === "text" && Boolean(element.containerId),
  )

  for (const text of texts) {
    const containerId = text.containerId
    if (!containerId) {
      continue
    }
    const container = elements.get(containerId)
    if (!isBoundTextContainer(container)) {
      removals.push(text.id)
      continue
    }

    const maxWidth =
      container.type === "arrow"
        ? null
        : getBoundTextMaxWidth(container, text.fontSize)
    let next = text
    if (container.type === "arrow") {
      if (text.autoSize !== true || text.wrapWidth !== null) {
        const layout = measureTextElement(
          { ...text, autoSize: true, wrapWidth: null },
          measurer,
        )
        next = {
          ...text,
          autoSize: true,
          height: layout.height,
          width: layout.width,
          wrapWidth: null,
        }
      }
    } else if (
      maxWidth !== null &&
      (text.autoSize !== false || text.wrapWidth !== maxWidth)
    ) {
      const layout = measureTextElement(
        { ...text, autoSize: false, width: maxWidth, wrapWidth: maxWidth },
        measurer,
      )
      next = {
        ...text,
        autoSize: false,
        height: layout.height,
        width: layout.width,
        wrapWidth: maxWidth,
      }
    }

    let currentContainer = container
    const grown =
      next.text.trim() === ""
        ? null
        : growBoundTextContainer(currentContainer, next.height)
    if (grown) {
      elements.set(currentContainer.id, grown)
      currentContainer = grown
      changed = true
    }

    const center = getBoundTextCenter(currentContainer, next.labelPosition)
    const x = center.x - next.width / 2
    const y = center.y - next.height / 2
    const visible = currentContainer.visible
    if (
      next !== text ||
      text.x !== x ||
      text.y !== y ||
      text.rotation !== center.rotation ||
      text.visible !== visible
    ) {
      elements.set(text.id, {
        ...next,
        rotation: center.rotation,
        visible,
        x,
        y,
      })
      changed = true
    }
  }

  for (const id of removals) {
    elements.delete(id)
    changed = true
  }

  return changed
}
