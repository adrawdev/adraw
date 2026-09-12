import type {
  ArrowBinding,
  ArrowElement,
  CanvasElement,
  ElementId,
  Point,
} from "./types"

// Pointer distance, in screen pixels, within which the pointer is considered to
// be over a bindable element. Callers divide by the viewport zoom to get canvas
// units.
export const BINDING_PICK_MARGIN = 8
// Minimum visible gap between a bound arrow tip and the target's border.
export const BINDING_GAP = 4

const BINDABLE_TYPES = new Set([
  "rectangle",
  "ellipse",
  "text",
  "media",
  "group",
])

// Only elements with an area can be bound: an endpoint resolves to the target's
// center and the visible stroke is clipped at its border. Open geometry (lines,
// paths, other arrows) has no border to clip against.
export function isBindableElement(element: CanvasElement): boolean {
  return BINDABLE_TYPES.has(element.type)
}

// Topmost visible bindable element whose (rotated) bounding box contains the
// point, expanded by `margin` canvas units. Invisible elements cannot be picked;
// locked ones can (a locked target still moves with its own drag).
export function findBindingTarget(
  elements: Map<ElementId, CanvasElement>,
  point: Point,
  margin: number,
): CanvasElement | null {
  const candidates = [...elements.values()]
    .filter((element) => element.visible && isBindableElement(element))
    .toSorted((a, b) => b.zIndex - a.zIndex)

  for (const element of candidates) {
    if (pointInExpandedBounds(point, element, margin)) {
      return element
    }
  }
  return null
}

function pointInExpandedBounds(
  point: Point,
  element: CanvasElement,
  margin: number,
): boolean {
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  const dx = point.x - cx
  const dy = point.y - cy
  let rx = dx
  let ry = dy

  if (element.rotation) {
    const rad = (-element.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    rx = cos * dx - sin * dy
    ry = sin * dx + cos * dy
  }

  return (
    Math.abs(rx) <= element.width / 2 + margin &&
    Math.abs(ry) <= element.height / 2 + margin
  )
}

function centerOf(element: CanvasElement): Point {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}

// Point on the target's border along `direction` (from its center), pushed
// `gap` units past the border (outward, toward the other endpoint). Rotation is
// handled by computing the ray/edge parameter in the target's local frame and
// scaling the world-space direction by it, since the center is invariant under
// rotation.
function clipToBorder(
  element: CanvasElement,
  direction: Point,
  gap: number,
): Point {
  const center = centerOf(element)
  const length = Math.hypot(direction.x, direction.y)
  if (length < 1e-6) {
    return center
  }

  const halfWidth = Math.max(element.width / 2, 0.5)
  const halfHeight = Math.max(element.height / 2, 0.5)

  let localX = direction.x
  let localY = direction.y
  if (element.rotation) {
    const rad = (-element.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    localX = cos * direction.x - sin * direction.y
    localY = sin * direction.x + cos * direction.y
  }

  let t: number
  if (element.type === "ellipse") {
    t = 1 / Math.hypot(localX / halfWidth, localY / halfHeight)
  } else {
    const tx =
      localX > 0
        ? halfWidth / localX
        : localX < 0
          ? -halfWidth / localX
          : Infinity
    const ty =
      localY > 0
        ? halfHeight / localY
        : localY < 0
          ? -halfHeight / localY
          : Infinity
    t = Math.min(tx, ty)
  }

  const scale = Math.max(0, t + gap / length)
  return {
    x: center.x + direction.x * scale,
    y: center.y + direction.y * scale,
  }
}

function isValidBinding(
  binding: ArrowBinding | null | undefined,
  elements: Map<ElementId, CanvasElement>,
  selfId: ElementId,
): binding is ArrowBinding {
  return Boolean(
    binding &&
    binding.elementId !== selfId &&
    elements.get(binding.elementId) &&
    isBindableElement(elements.get(binding.elementId)!),
  )
}

// Resolve an arrow against the current elements: aim each bound endpoint at the
// target's center and clip it at the target's border, dropping bindings whose
// target no longer exists (or is no longer bindable). Bounding-box fields are
// recomputed from the resolved endpoints. Pure — returns a new element.
export function resolveArrowElement(
  arrow: ArrowElement,
  elements: Map<ElementId, CanvasElement>,
): ArrowElement {
  const startBinding = isValidBinding(arrow.startBinding, elements, arrow.id)
    ? arrow.startBinding
    : null
  const endBinding = isValidBinding(arrow.endBinding, elements, arrow.id)
    ? arrow.endBinding
    : null

  let { startX, startY, endX, endY } = arrow

  if (startBinding || endBinding) {
    const startAnchor = startBinding
      ? centerOf(elements.get(startBinding.elementId)!)
      : { x: startX, y: startY }
    const endAnchor = endBinding
      ? centerOf(elements.get(endBinding.elementId)!)
      : { x: endX, y: endY }
    const direction = {
      x: endAnchor.x - startAnchor.x,
      y: endAnchor.y - startAnchor.y,
    }
    const gap = Math.max(BINDING_GAP, arrow.strokeWidth || 0)

    if (startBinding) {
      const clipped = clipToBorder(
        elements.get(startBinding.elementId)!,
        direction,
        gap,
      )
      startX = clipped.x
      startY = clipped.y
    }
    if (endBinding) {
      const clipped = clipToBorder(
        elements.get(endBinding.elementId)!,
        { x: -direction.x, y: -direction.y },
        gap,
      )
      endX = clipped.x
      endY = clipped.y
    }
  }

  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)

  return {
    ...arrow,
    endBinding,
    endX,
    endY,
    height: Math.max(Math.abs(endY - startY), 1),
    startBinding,
    startX,
    startY,
    width: Math.max(Math.abs(endX - startX), 1),
    x,
    y,
  }
}

function sameGeometry(a: ArrowElement, b: ArrowElement): boolean {
  return (
    a.startX === b.startX &&
    a.startY === b.startY &&
    a.endX === b.endX &&
    a.endY === b.endY &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.startBinding?.elementId === b.startBinding?.elementId &&
    a.endBinding?.elementId === b.endBinding?.elementId
  )
}

// Re-resolve every bound arrow in place. Returns true when anything changed.
export function syncArrowBindings(
  elements: Map<ElementId, CanvasElement>,
): boolean {
  let changed = false
  for (const [id, element] of elements) {
    if (element.type !== "arrow") {
      continue
    }
    if (!element.startBinding && !element.endBinding) {
      continue
    }
    const resolved = resolveArrowElement(element, elements)
    if (!sameGeometry(element, resolved)) {
      elements.set(id, resolved)
      changed = true
    }
  }
  return changed
}

// Drop the bindings of selected arrows whose targets are not part of the same
// gesture/selection (used before a direct move or bbox resize). Endpoints keep
// their last resolved coordinates. Returns true when anything changed.
export function detachArrowsOutsideSelection(
  elements: Map<ElementId, CanvasElement>,
  selectedIds: Set<ElementId>,
): boolean {
  let changed = false
  for (const id of selectedIds) {
    const element = elements.get(id)
    if (element?.type !== "arrow") {
      continue
    }
    const startBinding =
      element.startBinding && selectedIds.has(element.startBinding.elementId)
        ? element.startBinding
        : null
    const endBinding =
      element.endBinding && selectedIds.has(element.endBinding.elementId)
        ? element.endBinding
        : null
    if (
      startBinding !== element.startBinding ||
      endBinding !== element.endBinding
    ) {
      elements.set(id, { ...element, endBinding, startBinding })
      changed = true
    }
  }
  return changed
}
