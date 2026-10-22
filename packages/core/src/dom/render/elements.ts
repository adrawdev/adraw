import type { CanvasEngine } from "../../engine/engine"
import { getBoundTextBounds } from "../../text-bindings"
import type { CanvasElement, ElementId, Point } from "../../types"
import { updateElementGeometry } from "../render"
import type { DomState } from "../state"
import { createElementGroup, elementClass, selectedClass } from "../svg"

// Fingerprint of everything `updateElementGeometry` writes to the DOM for an
// element (group transform plus type-specific geometry and style). Nodes whose
// element fingerprints identically skip DOM writes, so a `change` event only
// touches the elements that actually changed. Media `src` is still creation-only.
function geometrySignature(
  state: DomState,
  element: CanvasElement,
  arrowLabelBox: {
    height: number
    width: number
    x: number
    y: number
  } | null = null,
): string {
  const base = `${element.x}|${element.y}|${element.width}|${element.height}|${element.rotation}|${element.opacity ?? 1}`
  switch (element.type) {
    case "line": {
      return `line|${base}|${element.startX}|${element.startY}|${element.endX}|${element.endY}|${element.strokeColor}|${element.strokeWidth}`
    }
    case "arrow": {
      const gap = arrowLabelBox
        ? `${arrowLabelBox.x}|${arrowLabelBox.y}|${arrowLabelBox.width}|${arrowLabelBox.height}`
        : ""
      return `arrow|${base}|${element.startX}|${element.startY}|${element.endX}|${element.endY}|${element.strokeColor}|${element.strokeWidth}|${element.startArrowhead ? 1 : 0}|${element.endArrowhead ? 1 : 0}|${element.startBinding?.elementId ?? ""}|${element.endBinding?.elementId ?? ""}|label:${gap}`
    }
    case "path": {
      return `path|${base}|${element.smoothing ?? ""}|${pathPointsSignature(state, element.id, element.points)}|${element.strokeColor}|${element.strokeWidth}`
    }
    case "text": {
      return `text|${base}|${element.text}|${element.fontSize}|${element.fontFamily ?? ""}|${element.textAlign ?? ""}|${element.lineHeight ?? ""}|${element.autoSize ?? ""}|${element.wrapWidth ?? ""}|${element.strokeColor}`
    }
    case "note": {
      return `note|${base}|${element.text}|${element.fontSize}|${element.fontFamily ?? ""}|${element.textAlign ?? ""}|${element.lineHeight ?? ""}|${element.padding}|${element.cornerRadius}|${element.fillColor}|${element.strokeColor}`
    }
    case "rectangle": {
      return `rectangle|${base}|${element.strokeColor}|${element.strokeWidth}|${element.cornerRadius}|${element.fillColor ?? ""}`
    }
    case "ellipse": {
      return `ellipse|${base}|${element.strokeColor}|${element.strokeWidth}|${element.fillColor ?? ""}`
    }
    default: {
      return `${element.type}|${base}`
    }
  }
}

// Serializing a path's points is O(points); cache by array identity. Committed
// elements are updated immutably (move/resize build a new `points` array), so a
// stable reference means unchanged points. Mutating a committed element's
// points array in place would be missed — mutation paths must stay immutable
// (they currently do).
function pathPointsSignature(
  state: DomState,
  id: ElementId,
  points: Point[],
): string {
  const cached = state.pathPointSigs.get(id)
  if (cached && cached.points === points) {
    return cached.sig
  }
  const sig = points.map((point) => `${point.x},${point.y}`).join(";")
  state.pathPointSigs.set(id, { points, sig })
  return sig
}

// Remove an element's caches when its node is dropped (deleted or hidden).
function forgetNode(state: DomState, id: ElementId): void {
  state.nodeById.delete(id)
  state.renderedGeometry.delete(id)
  state.pathPointSigs.delete(id)
}

// Bring one element's node in line with its current state: look it up in the
// node cache (adopting a same-id temporary node left by the committing tool),
// create it when missing, update geometry only when the fingerprint changed,
// and mirror the selection class. Returns the node, or null when hidden.
function syncElementNode(
  state: DomState,
  engine: CanvasEngine,
  element: CanvasElement,
): SVGGElement | null {
  let group = state.nodeById.get(element.id) ?? null

  // Tools that commit their temporary element under the same id (text) leave
  // that node in `elementsGroup`; adopt it instead of building a duplicate.
  // Like the previous `document.getElementById` lookup this keeps the node
  // as-is (temporary class included) and only updates its geometry.
  if (!group && state.temporaryNode && state.temporaryNode.id === element.id) {
    group = state.temporaryNode
    state.nodeById.set(element.id, group)
  }

  if (!element.visible) {
    if (group) {
      forgetNode(state, element.id)
      group.remove()
    }
    return null
  }

  const arrowLabelBox =
    element.type === "arrow"
      ? getBoundTextBounds(engine.getElements(), element.id)
      : null
  const signature = geometrySignature(state, element, arrowLabelBox)
  if (!group) {
    group = createElementGroup(element, engine.getTextMeasurer(), arrowLabelBox)
    group.classList.add(elementClass)
    state.elementsGroup!.appendChild(group)
    state.nodeById.set(element.id, group)
    state.renderedGeometry.set(element.id, signature)
  } else if (state.renderedGeometry.get(element.id) !== signature) {
    updateElementGeometry(
      group,
      element,
      engine.getTextMeasurer(),
      arrowLabelBox,
    )
    state.renderedGeometry.set(element.id, signature)
  }
  state.renderedGeometry.set(element.id, signature)

  // Toggle only on transitions: an unconditional `classList.toggle` serializes
  // the class attribute per node per render even when nothing changes.
  if (
    engine.getSelectedIds().has(element.id) !==
    group.classList.contains(selectedClass)
  ) {
    group.classList.toggle(
      selectedClass,
      engine.getSelectedIds().has(element.id),
    )
  }
  return group
}

// Reconcile `elementsGroup` with the current elements without wiping it: add
// nodes for new elements, update changed ones in place, and drop nodes for
// elements that no longer exist. Unchanged elements keep both their DOM node
// and its attributes untouched.
export function reconcileElements(state: DomState, engine: CanvasEngine): void {
  if (!state.elementsGroup) {
    return
  }

  const elements = engine.getElements()

  // Drop nodes for elements that no longer exist, leaving the temporary node
  // (which has no matching entry in `elements`) untouched. Iterate backwards:
  // `children` is live, so removing during a forward loop would skip nodes.
  const children = state.elementsGroup.children
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i]
    if (child === state.temporaryNode) {
      continue
    }
    if (!elements.has(child.id)) {
      forgetNode(state, child.id)
      child.remove()
    } else if (!state.nodeById.has(child.id)) {
      // Adopt untracked nodes (e.g. one adopted from a temporary element in an
      // earlier render) so subsequent renders update them through the cache.
      state.nodeById.set(child.id, child as SVGGElement)
    }
  }

  const orderedNodes: SVGGElement[] = []
  for (const element of [...elements.values()].toSorted(
    (a, b) => a.zIndex - b.zIndex,
  )) {
    const node = syncElementNode(state, engine, element)
    if (node) {
      orderedNodes.push(node)
    }
  }

  reorderElementNodes(state.elementsGroup, orderedNodes)
}

// Put element nodes in ascending z-index order, leaving the in-progress
// temporary node on top. Only writes to the DOM when the order differs.
function reorderElementNodes(group: SVGGElement, ordered: SVGGElement[]): void {
  const children = group.children
  let needsReorder = false
  for (let i = 0; i < ordered.length; i++) {
    if (children[i] !== ordered[i]) {
      needsReorder = true
      break
    }
  }
  if (!needsReorder) {
    return
  }

  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i]
    const current = children[i]
    if (current !== node) {
      if (current) {
        current.before(node)
      } else {
        group.appendChild(node)
      }
    }
  }
}

export function renderSelectElements(
  state: DomState,
  engine: CanvasEngine,
): void {
  if (!state.elementsGroup) {
    return
  }

  const elements = engine.getElements()
  const selectedIds = engine.getSelectedIds()

  // This is the incremental path (used while the select tool is active), so it
  // updates existing nodes in place rather than rebuilding. It must still drop
  // DOM nodes for elements that no longer exist — e.g. when a selected element
  // is deleted, the "change" handler routes here instead of reconcileElements().
  // Iterate backwards: `children` is a live collection and removing during a
  // forward loop would skip nodes.
  const children = state.elementsGroup.children
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i]
    if (!elements.has(child.id)) {
      forgetNode(state, child.id)
      child.remove()
    }
  }

  for (const [, element] of elements) {
    if (!element.visible) {
      continue
    }

    const group = state.nodeById.get(element.id)
    if (!group) {
      continue
    }
    const isSelected = selectedIds.has(element.id)
    // Toggle only on transitions (see `syncElementNode`).
    if (isSelected !== group.classList.contains(selectedClass)) {
      group.classList.toggle(selectedClass, isSelected)
    }

    if (!isSelected) {
      continue
    }

    // The select tool already transforms geometry in canvas space, so just
    // re-render each selected node — but only when its element changed.
    const arrowLabelBox =
      element.type === "arrow"
        ? getBoundTextBounds(engine.getElements(), element.id)
        : null
    const signature = geometrySignature(state, element, arrowLabelBox)
    if (state.renderedGeometry.get(element.id) !== signature) {
      updateElementGeometry(
        group,
        element,
        engine.getTextMeasurer(),
        arrowLabelBox,
      )
      state.renderedGeometry.set(element.id, signature)
    }
  }
}
