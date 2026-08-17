import type { CanvasEngine } from "../../engine/engine"
import { updateElementGeometry } from "../render"
import type { DomState } from "../state"
import { createElementGroup, elementClass, selectedClass } from "../svg"

// Reconcile `elementsGroup` with the current elements without wiping it: add
// nodes for new elements, update existing ones in place, and drop nodes for
// elements that no longer exist. This keeps untouched elements' DOM nodes
// intact when a new element is added (rather than rebuilding the whole group).
export function reconcileElements(state: DomState, engine: CanvasEngine): void {
  if (!state.elementsGroup) {
    return
  }

  const elements = engine.getElements()
  const selectedIds = engine.getSelectedIds()

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
      child.remove()
    }
  }

  for (const [, element] of elements) {
    let group = document.getElementById(element.id) as SVGGElement | null

    if (!element.visible) {
      group?.remove()
      continue
    }

    if (group) {
      updateElementGeometry(group, element)
    } else {
      group = createElementGroup(element)
      group.classList.add(elementClass)
      state.elementsGroup.appendChild(group)
    }

    group.classList.toggle(selectedClass, selectedIds.has(element.id))
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
  // Snapshot into an array: `children` is a live collection and removing
  // during iteration would skip nodes.
  for (const child of state.elementsGroup.children) {
    if (!elements.has(child.id)) {
      child.remove()
    }
  }

  for (const [, element] of elements) {
    if (!element.visible) {
      continue
    }

    const group = document.getElementById(element.id) as SVGGElement | null
    if (!group) {
      continue
    }
    const isSelected = selectedIds.has(element.id)
    group.classList.toggle(selectedClass, isSelected)

    if (!isSelected) {
      continue
    }

    // The select tool already transforms geometry in canvas space, so just
    // re-render each node from the current element state.
    updateElementGeometry(group, element)
  }
}
