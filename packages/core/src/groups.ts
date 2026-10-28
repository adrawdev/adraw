import { generateId } from "./coordinates"
import type {
  BoundingBox,
  CanvasElement,
  ElementId,
  GroupElement,
} from "./types"

export type ElementMap = Map<ElementId, CanvasElement>

/**
 * Parent/group lookup built from one element map. Reuse it for every hierarchy
 * query in a single operation instead of rescanning the map per lookup.
 *
 * @internal
 */
export interface GroupIndex {
  elements: ElementMap
  groupById: Map<ElementId, GroupElement>
  parentById: Map<ElementId, ElementId>
}

/**
 * Build a parent lookup for every group child.
 *
 * @internal
 */
export function createGroupIndex(elements: ElementMap): GroupIndex {
  const groupById = new Map<ElementId, GroupElement>()
  const parentById = new Map<ElementId, ElementId>()

  for (const [id, element] of elements) {
    if (element.type !== "group") {
      continue
    }
    groupById.set(id, element)
    for (const childId of element.children) {
      // First parent wins for malformed documents with shared children.
      if (!parentById.has(childId)) {
        parentById.set(childId, id)
      }
    }
  }

  return { elements, groupById, parentById }
}

/**
 * Immediate parent group of an element, or null for a top-level element.
 *
 * @internal
 */
export function getParentGroupId(
  index: GroupIndex,
  id: ElementId,
): ElementId | null {
  return index.parentById.get(id) ?? null
}

/**
 * Outermost group ancestor of an element. Returns the element itself when it
 * has no group ancestor.
 *
 * @internal
 */
export function getTopLevelId(index: GroupIndex, id: ElementId): ElementId {
  let top = id
  let current = index.parentById.get(id)
  const seen = new Set<ElementId>()

  while (current && !seen.has(current)) {
    seen.add(current)
    top = current
    current = index.parentById.get(current)
  }

  return top
}

/**
 * The child of `parentId` that contains `descendantId`. With a null parent,
 * resolves to the outermost top-level id.
 *
 * @internal
 */
export function getDirectChildId(
  index: GroupIndex,
  parentId: ElementId | null,
  descendantId: ElementId,
): ElementId | null {
  if (!parentId) {
    return getTopLevelId(index, descendantId)
  }

  let current: ElementId | undefined = descendantId
  const seen = new Set<ElementId>()

  while (current && !seen.has(current)) {
    seen.add(current)
    const parent = index.parentById.get(current)
    if (parent === parentId) {
      return current
    }
    current = parent ?? undefined
  }

  return null
}

/**
 * Whether `id` is a strict descendant of `ancestorId`.
 *
 * @internal
 */
export function isDescendantOf(
  index: GroupIndex,
  id: ElementId,
  ancestorId: ElementId,
): boolean {
  let current = index.parentById.get(id)
  const seen = new Set<ElementId>()

  while (current && !seen.has(current)) {
    if (current === ancestorId) {
      return true
    }
    seen.add(current)
    current = index.parentById.get(current)
  }

  return false
}

// Walk the element and every group ancestor.
function everyAncestor(
  index: GroupIndex,
  id: ElementId,
  predicate: (element: CanvasElement) => boolean,
): boolean {
  let current: ElementId | undefined = id
  const seen = new Set<ElementId>()

  while (current && !seen.has(current)) {
    seen.add(current)
    const element = index.elements.get(current)
    if (!element || !predicate(element)) {
      return false
    }
    current = index.parentById.get(current) ?? undefined
  }

  return true
}

/**
 * Visibility of an element including every group ancestor.
 *
 * @internal
 */
export function isEffectivelyVisible(
  index: GroupIndex,
  id: ElementId,
): boolean {
  return everyAncestor(index, id, (element) => element.visible)
}

/**
 * Lock state of an element including every group ancestor.
 *
 * @internal
 */
export function isEffectivelyLocked(index: GroupIndex, id: ElementId): boolean {
  return !everyAncestor(index, id, (element) => !element.locked)
}

/**
 * Whether a group has at least one visible leaf descendant.
 *
 * @internal
 */
export function hasVisibleContent(index: GroupIndex, id: ElementId): boolean {
  const seen = new Set<ElementId>()

  const visit = (currentId: ElementId): boolean => {
    if (seen.has(currentId)) {
      return false
    }
    seen.add(currentId)
    const element = index.elements.get(currentId)
    if (!element || !element.visible) {
      return false
    }
    if (element.type !== "group") {
      return true
    }
    return element.children.some(visit)
  }

  return visit(id)
}

/**
 * Direct children of a context group, or every top-level element when the
 * context is null.
 *
 * @internal
 */
export function getContextChildren(
  index: GroupIndex,
  contextId: ElementId | null,
): ElementId[] {
  if (contextId) {
    const group = index.groupById.get(contextId)
    return group ? group.children.filter((id) => index.elements.has(id)) : []
  }

  const children: ElementId[] = []
  for (const id of index.elements.keys()) {
    if (!index.parentById.has(id)) {
      children.push(id)
    }
  }
  return children
}

/**
 * Direct children of a context that can be selected: visible, unlocked, and
 * groups with visible content.
 *
 * @internal
 */
export function getSelectableChildren(
  index: GroupIndex,
  contextId: ElementId | null,
): ElementId[] {
  return getContextChildren(index, contextId).filter((id) => {
    if (!isEffectivelyVisible(index, id) || isEffectivelyLocked(index, id)) {
      return false
    }
    const element = index.elements.get(id)
    if (element?.type === "group" && !hasVisibleContent(index, id)) {
      return false
    }
    return true
  })
}

/**
 * Resolve the selectable object at the current drill level for a hit element.
 * Returns null when the hit is outside the entered group.
 *
 * @internal
 */
export function resolveSelectionTargetId(
  index: GroupIndex,
  hitId: ElementId,
  contextId: ElementId | null,
): ElementId | null {
  return contextId
    ? getDirectChildId(index, contextId, hitId)
    : getTopLevelId(index, hitId)
}

/**
 * Map a selection to the direct children of a context (or top-level objects).
 *
 * @internal
 */
export function normalizeSelectionForLevel(
  index: GroupIndex,
  ids: Iterable<ElementId>,
  contextId: ElementId | null,
): Set<ElementId> {
  const normalized = new Set<ElementId>()
  for (const id of ids) {
    const target = contextId
      ? getDirectChildId(index, contextId, id)
      : getTopLevelId(index, id)
    if (target) {
      normalized.add(target)
    }
  }
  return normalized
}

/**
 * All non-group descendants of the given elements. Groups themselves expand to
 * their leaves; leaves are returned as-is.
 *
 * @internal
 */
export function getLeafDescendantIds(
  index: GroupIndex,
  ids: Iterable<ElementId>,
): Set<ElementId> {
  const leaves = new Set<ElementId>()
  const seen = new Set<ElementId>()

  const visit = (id: ElementId): void => {
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    const element = index.elements.get(id)
    if (!element) {
      return
    }
    if (element.type === "group") {
      for (const childId of element.children) {
        visit(childId)
      }
      return
    }
    leaves.add(id)
  }

  for (const id of ids) {
    visit(id)
  }
  return leaves
}

/**
 * Everything a transform of `ids` can affect: each id, its whole group subtree,
 * and its group ancestors (whose derived bounds change too). Used to exclude
 * moving elements from snapping and to keep their arrow bindings.
 *
 * @internal
 */
export function getAffectedIds(
  index: GroupIndex,
  ids: Iterable<ElementId>,
): Set<ElementId> {
  const affected = new Set<ElementId>()
  const ancestorsSeen = new Set<ElementId>()

  for (const id of ids) {
    for (const subtreeId of collectSubtreeIds(index, [id])) {
      affected.add(subtreeId)
    }

    let parent = index.parentById.get(id)
    while (parent && !ancestorsSeen.has(parent)) {
      ancestorsSeen.add(parent)
      affected.add(parent)
      parent = index.parentById.get(parent)
    }
  }

  return affected
}

/**
 * The given ids plus every group descendant, used for destructive operations.
 *
 * @internal
 */
export function collectSubtreeIds(
  index: GroupIndex,
  ids: Iterable<ElementId>,
): Set<ElementId> {
  const collected = new Set<ElementId>()
  const seen = new Set<ElementId>()

  const visit = (id: ElementId): void => {
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    const element = index.elements.get(id)
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

/**
 * The entered group followed by every group ancestor, nearest first.
 *
 * @internal
 */
export function getContextChain(
  index: GroupIndex,
  contextId: ElementId | null,
): ElementId[] {
  const chain: ElementId[] = []
  let current = contextId
  const seen = new Set<ElementId>()

  while (current && !seen.has(current)) {
    seen.add(current)
    chain.push(current)
    current = index.parentById.get(current) ?? null
  }

  return chain
}

/**
 * First group in a context chain that still exists. Lets a context fall back
 * to its parent when the entered group disappears.
 *
 * @internal
 */
export function resolveContextChain(
  elements: ElementMap,
  chain: Iterable<ElementId>,
): ElementId | null {
  for (const id of chain) {
    if (elements.get(id)?.type === "group") {
      return id
    }
  }
  return null
}

function computeBoundsForIds(
  index: GroupIndex,
  ids: Iterable<ElementId>,
): BoundingBox | null {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity

  for (const id of ids) {
    const element = index.elements.get(id)
    if (!element || !isEffectivelyVisible(index, id)) {
      continue
    }
    left = Math.min(left, element.x)
    right = Math.max(right, element.x + element.width)
    top = Math.min(top, element.y)
    bottom = Math.max(bottom, element.y + element.height)
  }

  if (left === Infinity) {
    return null
  }
  return {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  }
}

/**
 * Result of grouping the current selection.
 *
 * @internal
 */
export interface GroupSelectionResult {
  elements: ElementMap
  group: GroupElement | null
  parentId: ElementId | null
}

function collapseContained(
  index: GroupIndex,
  ids: Set<ElementId>,
): Set<ElementId> {
  const collapsed = new Set<ElementId>()
  for (const id of ids) {
    let parent = index.parentById.get(id)
    const seen = new Set<ElementId>()
    let contained = false
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      if (ids.has(parent)) {
        contained = true
        break
      }
      parent = index.parentById.get(parent)
    }
    if (!contained) {
      collapsed.add(id)
    }
  }
  return collapsed
}

/**
 * Group the selection at its shared parent. Includes bound text of selected
 * containers; normalizes cross-parent selections to the top level.
 *
 * @internal
 */
export function groupSelection(
  elements: ElementMap,
  selectedIds: Iterable<ElementId>,
): GroupSelectionResult {
  const index = createGroupIndex(elements)
  const ids = new Set<ElementId>()

  for (const id of selectedIds) {
    if (elements.has(id)) {
      ids.add(id)
    }
  }
  if (ids.size === 0) {
    return { elements, group: null, parentId: null }
  }

  // The minimum counts explicitly selected objects, not the bound text that a
  // container implicitly brings along: grouping one shape with bound text is a no-op.
  if (collapseContained(index, ids).size < 2) {
    return { elements, group: null, parentId: null }
  }

  const boundTextByContainer = new Map<ElementId, ElementId[]>()
  for (const element of elements.values()) {
    if (element.type === "text" && element.containerId) {
      const boundTextIds = boundTextByContainer.get(element.containerId) ?? []
      boundTextIds.push(element.id)
      boundTextByContainer.set(element.containerId, boundTextIds)
    }
  }

  // Selected bound text brings its container, and a selected container brings
  // its bound text, so the pair always moves into the new group together.
  const containers = new Set<ElementId>()
  for (const id of ids) {
    const element = elements.get(id)
    if (element?.type === "text" && element.containerId) {
      containers.add(element.containerId)
    }
  }
  for (const id of containers) {
    ids.add(id)
  }

  const boundTextAdditions: ElementId[] = []
  for (const id of ids) {
    for (const boundTextId of boundTextByContainer.get(id) ?? []) {
      boundTextAdditions.push(boundTextId)
    }
  }
  for (const id of boundTextAdditions) {
    ids.add(id)
  }

  // Drop ids already inside another selected group.
  const collapsed = collapseContained(index, ids)

  const parents = new Set<ElementId | null>()
  for (const id of collapsed) {
    parents.add(index.parentById.get(id) ?? null)
  }

  let parentId: ElementId | null = null
  if (parents.size === 1) {
    parentId = [...parents][0] ?? null
  } else {
    // Mixed parents: group the outermost objects at the top level instead of
    // pulling elements out of their existing groups.
    const topLevel = new Set<ElementId>()
    for (const id of collapsed) {
      topLevel.add(getTopLevelId(index, id))
    }
    collapsed.clear()
    for (const id of topLevel) {
      collapsed.add(id)
    }
  }

  if (collapsed.size < 2) {
    return { elements, group: null, parentId }
  }

  const children = [...collapsed]
  const bounds = computeBoundsForIds(index, children)
  let zIndex = -Infinity
  for (const id of children) {
    const element = elements.get(id)
    if (element) {
      zIndex = Math.max(zIndex, element.zIndex)
    }
  }

  const group: GroupElement = {
    children,
    height: bounds?.height ?? 0,
    id: generateId(),
    locked: false,
    opacity: 1,
    rotation: 0,
    type: "group",
    visible: true,
    width: bounds?.width ?? 0,
    x: bounds?.x ?? 0,
    y: bounds?.y ?? 0,
    zIndex: Number.isFinite(zIndex) ? zIndex : 0,
  }

  const next = new Map(elements)
  next.set(group.id, group)

  if (parentId) {
    const parent = next.get(parentId)
    if (parent?.type === "group") {
      const nextChildren: ElementId[] = []
      let inserted = false
      for (const childId of parent.children) {
        if (collapsed.has(childId)) {
          if (!inserted) {
            nextChildren.push(group.id)
            inserted = true
          }
          continue
        }
        nextChildren.push(childId)
      }
      if (!inserted) {
        nextChildren.push(group.id)
      }
      next.set(parentId, { ...parent, children: nextChildren })
    }
  }

  return { elements: next, group, parentId }
}

/**
 * Result of ungrouping the current selection.
 *
 * @internal
 */
export interface UngroupResult {
  elements: ElementMap
  releasedIds: ElementId[]
  removedGroupIds: ElementId[]
}

/**
 * Remove the selected groups, one level only, replacing each with its children
 * in its parent.
 *
 * @internal
 */
export function ungroupSelection(
  elements: ElementMap,
  selectedIds: Iterable<ElementId>,
): UngroupResult {
  const index = createGroupIndex(elements)
  const selectedGroups = new Set<ElementId>()

  for (const id of selectedIds) {
    if (index.groupById.has(id)) {
      selectedGroups.add(id)
    }
  }
  if (selectedGroups.size === 0) {
    return { elements, releasedIds: [], removedGroupIds: [] }
  }

  // Selecting both a group and one of its descendants only ungroups the outer
  // group; the nested group is released intact.
  const outermost = new Set<ElementId>()
  for (const id of selectedGroups) {
    let parent = index.parentById.get(id)
    const seen = new Set<ElementId>()
    let contained = false
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      if (selectedGroups.has(parent)) {
        contained = true
        break
      }
      parent = index.parentById.get(parent)
    }
    if (!contained) {
      outermost.add(id)
    }
  }

  const next = new Map(elements)
  const releasedIds: ElementId[] = []
  const removedGroupIds: ElementId[] = []

  for (const groupId of outermost) {
    const group = next.get(groupId)
    if (group?.type !== "group") {
      continue
    }
    const parentId = index.parentById.get(groupId) ?? null
    const children = group.children.filter((childId) => next.has(childId))
    next.delete(groupId)

    if (parentId) {
      const parent = next.get(parentId)
      if (parent?.type === "group") {
        const nextChildren: ElementId[] = []
        for (const childId of parent.children) {
          if (childId === groupId) {
            nextChildren.push(...children)
          } else {
            nextChildren.push(childId)
          }
        }
        next.set(parentId, { ...parent, children: nextChildren })
      }
    }

    releasedIds.push(...children)
    removedGroupIds.push(groupId)
  }

  return {
    elements: next,
    releasedIds: [...new Set(releasedIds)],
    removedGroupIds,
  }
}

interface GroupMetrics {
  bounds: BoundingBox | null
  zIndex: number
}

/**
 * Keep every group's derived bounds and topmost-child z-index in sync, and
 * drop groups whose children no longer exist. Mutates `elements` in place.
 *
 * @internal
 */
export function syncGroupState(elements: ElementMap): boolean {
  let hasGroup = false
  for (const element of elements.values()) {
    if (element.type === "group") {
      hasGroup = true
      break
    }
  }
  if (!hasGroup) {
    return false
  }

  let changed = false

  // Remove dangling child references and groups that became empty. Repeat
  // because removing a group can empty its parent.
  let pruned = true
  while (pruned) {
    pruned = false
    const removals: ElementId[] = []
    const updates: [ElementId, GroupElement][] = []

    for (const [id, element] of elements) {
      if (element.type !== "group") {
        continue
      }
      const children = element.children.filter((childId) =>
        elements.has(childId),
      )
      if (children.length === 0) {
        removals.push(id)
      } else if (children.length !== element.children.length) {
        updates.push([id, { ...element, children }])
      }
    }

    for (const [id, element] of updates) {
      elements.set(id, element)
      changed = true
    }
    for (const id of removals) {
      elements.delete(id)
      pruned = true
      changed = true
    }
  }

  const metrics = new Map<ElementId, GroupMetrics>()
  const visiting = new Set<ElementId>()

  const compute = (groupId: ElementId): GroupMetrics => {
    const cached = metrics.get(groupId)
    if (cached) {
      return cached
    }
    const group = elements.get(groupId)
    if (group?.type !== "group") {
      return { bounds: null, zIndex: 0 }
    }
    if (visiting.has(groupId)) {
      return { bounds: null, zIndex: group.zIndex }
    }
    visiting.add(groupId)

    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    let zIndex = -Infinity

    for (const childId of group.children) {
      const child = elements.get(childId)
      if (!child) {
        continue
      }

      if (child.type === "group") {
        const childMetrics = compute(childId)
        zIndex = Math.max(zIndex, childMetrics.zIndex)
        if (child.visible && childMetrics.bounds) {
          left = Math.min(left, childMetrics.bounds.x)
          right = Math.max(
            right,
            childMetrics.bounds.x + childMetrics.bounds.width,
          )
          top = Math.min(top, childMetrics.bounds.y)
          bottom = Math.max(
            bottom,
            childMetrics.bounds.y + childMetrics.bounds.height,
          )
        }
      } else {
        zIndex = Math.max(zIndex, child.zIndex)
        if (child.visible) {
          left = Math.min(left, child.x)
          right = Math.max(right, child.x + child.width)
          top = Math.min(top, child.y)
          bottom = Math.max(bottom, child.y + child.height)
        }
      }
    }

    visiting.delete(groupId)
    const result: GroupMetrics = {
      bounds:
        left === Infinity
          ? null
          : { height: bottom - top, width: right - left, x: left, y: top },
      zIndex: Number.isFinite(zIndex) ? zIndex : group.zIndex,
    }
    metrics.set(groupId, result)
    return result
  }

  for (const [id, element] of elements) {
    if (element.type !== "group") {
      continue
    }
    const group = element
    const nextMetrics = compute(id)
    const x = nextMetrics.bounds?.x ?? group.x
    const y = nextMetrics.bounds?.y ?? group.y
    const width = nextMetrics.bounds?.width ?? 0
    const height = nextMetrics.bounds?.height ?? 0
    const zIndex = nextMetrics.zIndex

    if (
      group.x !== x ||
      group.y !== y ||
      group.width !== width ||
      group.height !== height ||
      group.rotation !== 0 ||
      group.zIndex !== zIndex
    ) {
      elements.set(id, {
        ...group,
        height,
        rotation: 0,
        width,
        x,
        y,
        zIndex,
      })
      changed = true
    }
  }

  return changed
}
