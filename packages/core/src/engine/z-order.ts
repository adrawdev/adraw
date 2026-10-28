import type { CanvasElement, ElementId } from "../types"

type ElementMap = Map<ElementId, CanvasElement>

// Expand ids with the children of any group element, recursively, so moving a
// group also moves everything it renders.
function collectIds(
  elements: ElementMap,
  ids: Iterable<ElementId>,
): Set<ElementId> {
  const collected = new Set<ElementId>()
  const boundText = new Map<ElementId, ElementId[]>()
  for (const element of elements.values()) {
    if (element.type === "text" && element.containerId) {
      const list = boundText.get(element.containerId) ?? []
      list.push(element.id)
      boundText.set(element.containerId, list)
    }
  }

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
    // A container carries its bound label through z-order changes so the label
    // stays above the shape it belongs to.
    for (const textId of boundText.get(id) ?? []) {
      visit(textId)
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
 * Set one element's z-index to an exact value. A group is stacked as a unit:
 * its descendants shift together so the group's topmost child lands on the
 * requested index, and the group's derived z-index follows.
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
  if (!element) {
    return null
  }

  if (element.type !== "group") {
    if (element.zIndex === zIndex) {
      return null
    }
    const next = new Map(elements)
    next.set(id, { ...element, zIndex })
    return next
  }

  const groupIds = collectIds(elements, [id])
  let top = -Infinity
  for (const groupId of groupIds) {
    if (groupId === id) {
      continue
    }
    const child = elements.get(groupId)
    if (child) {
      top = Math.max(top, child.zIndex)
    }
  }
  if (!Number.isFinite(top)) {
    return null
  }

  const delta = zIndex - top
  if (delta === 0) {
    return null
  }

  const next = new Map(elements)
  for (const groupId of groupIds) {
    const child = elements.get(groupId)
    if (child) {
      next.set(groupId, { ...child, zIndex: child.zIndex + delta })
    }
  }
  return next
}
