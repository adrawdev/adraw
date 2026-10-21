import type { CanvasElement, ElementId } from "../types"

type ElementMap = Map<ElementId, CanvasElement>

// Expand ids with the children of any group element, recursively, so moving a
// group also moves everything it renders.
function collectIds(
  elements: ElementMap,
  ids: Iterable<ElementId>,
): Set<ElementId> {
  const collected = new Set<ElementId>()

  const visit = (id: ElementId): void => {
    if (collected.has(id)) {
      return
    }
    const element = elements.get(id)
    if (!element) {
      return
    }
    collected.add(id)
    if (element.type === "group") {
      for (const childId of element.children) {
        visit(childId)
      }
    }
  }

  for (const id of ids) {
    visit(id)
  }

  return collected
}

// Current stacking order among `ids`. `toSorted` is stable, so equal
// z-indexes keep their Map insertion order.
function orderedSelection(
  elements: ElementMap,
  ids: Set<ElementId>,
): CanvasElement[] {
  return [...elements.values()]
    .filter((element) => ids.has(element.id))
    .toSorted((a, b) => a.zIndex - b.zIndex)
}

// Assign a new z-index to every element the callback changes, cloning the map
// lazily. Returns null when nothing changed.
function reassign(
  elements: ElementMap,
  ordered: CanvasElement[],
  getZIndex: (element: CanvasElement, index: number) => number,
): ElementMap | null {
  let next: ElementMap | null = null

  for (let index = 0; index < ordered.length; index++) {
    const element = ordered[index]
    const zIndex = getZIndex(element, index)
    if (element.zIndex === zIndex) {
      continue
    }
    next ??= new Map(elements)
    next.set(element.id, { ...element, zIndex })
  }

  return next
}

/**
 * Move `ids` above every other element, preserving their relative order.
 * Group elements carry their children.
 * @returns A new element map, or null when nothing changed.
 */
export function bringElementsToFront(
  elements: ElementMap,
  ids: Iterable<ElementId>,
): ElementMap | null {
  const movingIds = collectIds(elements, ids)
  if (movingIds.size === 0) {
    return null
  }

  let top = -Infinity
  for (const element of elements.values()) {
    if (!movingIds.has(element.id)) {
      top = Math.max(top, element.zIndex)
    }
  }
  if (top === -Infinity) {
    top = -1
  }

  return reassign(
    elements,
    orderedSelection(elements, movingIds),
    (_element, index) => top + 1 + index,
  )
}

/**
 * Move `ids` below every other element, preserving their relative order.
 * Group elements carry their children.
 * @returns A new element map, or null when nothing changed.
 */
export function sendElementsToBack(
  elements: ElementMap,
  ids: Iterable<ElementId>,
): ElementMap | null {
  const movingIds = collectIds(elements, ids)
  if (movingIds.size === 0) {
    return null
  }

  const moving = orderedSelection(elements, movingIds)

  let bottom = Infinity
  for (const element of elements.values()) {
    if (!movingIds.has(element.id)) {
      bottom = Math.min(bottom, element.zIndex)
    }
  }

  // With nothing else on the canvas, normalize to 0..n-1.
  const base = bottom === Infinity ? moving.length : bottom

  return reassign(
    elements,
    moving,
    (_element, index) => base - moving.length + index,
  )
}

/**
 * Set one element's z-index to an exact value.
 * @returns A new element map, or null when the element is missing or already
 * has that z-index.
 */
export function setElementZIndex(
  elements: ElementMap,
  id: ElementId,
  zIndex: number,
): ElementMap | null {
  if (!Number.isFinite(zIndex)) {
    throw new RangeError("setZIndex: zIndex must be a finite number")
  }

  const element = elements.get(id)
  if (!element || element.zIndex === zIndex) {
    return null
  }

  const next = new Map(elements)
  next.set(id, { ...element, zIndex })
  return next
}
