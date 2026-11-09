import { isBindableElement } from "../arrow-bindings"
import {
  createGroupIndex,
  getLeafDescendantIds,
  type GroupIndex,
} from "../groups"
import { getNoteMinHeight } from "../note"
import { measureTextElement, type TextMeasurer } from "../text"
import { isBoundTextContainer } from "../text-bindings"
import type {
  ArrowBinding,
  ArrowElement,
  CanvasElement,
  ElementId,
  ElementType,
  GroupElement,
  LineElement,
  NoteElement,
  PathElement,
  Point,
  TextElement,
} from "../types"
import { applyStyleToElement } from "./style"
import { setElementZIndex } from "./z-order"

/**
 * A validated partial update for one canvas element. `id` and `type` are
 * immutable, and each element type only accepts the fields it owns. Derived
 * fields — line, arrow and path bounds, text height, group bounds and rotation,
 * and the position, size, lock state and visibility of bound text — are
 * rejected; update their source fields instead.
 *
 * @example
 * ```ts
 * const patch: ElementPatch = { fillColor: "#ffd43b", strokeWidth: 3 }
 * ```
 */
export type ElementPatch<T extends CanvasElement = CanvasElement> =
  T extends CanvasElement ? Partial<Omit<T, "id" | "type">> : never

/**
 * One element update in an `updateElements` batch.
 */
export interface ElementUpdate {
  id: ElementId
  patch: ElementPatch
}

/**
 * Result of an `updateElements` batch.
 */
export interface ElementUpdateResult {
  /** Elements that were found and updated, in input order. */
  updated: CanvasElement[]
  /** Ids that were not present on the canvas. */
  missing: ElementId[]
}

const COMMON_FIELDS = [
  "x",
  "y",
  "width",
  "height",
  "rotation",
  "zIndex",
  "locked",
  "visible",
  "opacity",
] as const

const FIELDS: Record<ElementType, ReadonlySet<string>> = {
  arrow: new Set([
    ...COMMON_FIELDS,
    "startX",
    "startY",
    "endX",
    "endY",
    "strokeWidth",
    "strokeColor",
    "startArrowhead",
    "endArrowhead",
    "startBinding",
    "endBinding",
  ]),
  diamond: new Set([
    ...COMMON_FIELDS,
    "strokeWidth",
    "strokeColor",
    "fillColor",
  ]),
  ellipse: new Set([
    ...COMMON_FIELDS,
    "strokeWidth",
    "strokeColor",
    "fillColor",
  ]),
  group: new Set([...COMMON_FIELDS, "children"]),
  line: new Set([
    ...COMMON_FIELDS,
    "startX",
    "startY",
    "endX",
    "endY",
    "strokeWidth",
    "strokeColor",
  ]),
  media: new Set([
    ...COMMON_FIELDS,
    "src",
    "mimeType",
    "naturalWidth",
    "naturalHeight",
  ]),
  note: new Set([
    ...COMMON_FIELDS,
    "text",
    "fontSize",
    "strokeColor",
    "fillColor",
    "fontFamily",
    "textAlign",
    "lineHeight",
    "padding",
    "cornerRadius",
  ]),
  path: new Set([
    ...COMMON_FIELDS,
    "points",
    "strokeWidth",
    "strokeColor",
    "smoothing",
  ]),
  rectangle: new Set([
    ...COMMON_FIELDS,
    "cornerRadius",
    "strokeWidth",
    "strokeColor",
    "fillColor",
  ]),
  text: new Set([
    ...COMMON_FIELDS,
    "text",
    "fontSize",
    "strokeColor",
    "fontFamily",
    "textAlign",
    "lineHeight",
    "autoSize",
    "containerId",
    "labelPosition",
    "wrapWidth",
  ]),
}

const DERIVED_FIELDS: Partial<Record<ElementType, ReadonlySet<string>>> = {
  arrow: new Set(["height", "width"]),
  group: new Set(["height", "rotation", "width"]),
  line: new Set(["height", "width"]),
  path: new Set(["height", "width"]),
  text: new Set(["height", "wrapWidth"]),
}

const BOUND_TEXT_DERIVED = new Set([
  "autoSize",
  "height",
  "locked",
  "rotation",
  "visible",
  "width",
  "wrapWidth",
  "x",
  "y",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    for (let index = 0; index < a.length; index++) {
      if (!sameValue(a[index], b[index])) {
        return false
      }
    }
    return true
  }
  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a)
    if (aKeys.length !== Object.keys(b).length) {
      return false
    }
    for (const key of aKeys) {
      if (!Object.hasOwn(b, key) || !sameValue(a[key], b[key])) {
        return false
      }
    }
    return true
  }
  return false
}

function sameElement(a: CanvasElement, b: CanvasElement): boolean {
  return sameValue(a, b)
}

function setElement<T extends CanvasElement>(
  elements: Map<ElementId, CanvasElement>,
  original: T,
  next: T,
): T {
  if (sameElement(original, next)) {
    return original
  }
  elements.set(original.id, next)
  return next
}

function assertFiniteNumber(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`updateElement: "${field}" must be a finite number`)
  }
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`updateElement: "${field}" must be a string`)
  }
}

function assertBoolean(
  value: unknown,
  field: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`updateElement: "${field}" must be a boolean`)
  }
}

function derivedMessage(element: CanvasElement, field: string): string {
  switch (element.type) {
    case "arrow":
    case "line": {
      return `updateElement: "${field}" is derived from the line endpoints; patch startX, startY, endX or endY instead`
    }
    case "group": {
      return `updateElement: "${field}" is derived from the group's children; update the children instead`
    }
    case "path": {
      return `updateElement: "${field}" is derived from the path points; patch points instead`
    }
    case "text": {
      return `updateElement: "${field}" is derived from the text layout; patch text, fontSize or autoSize instead`
    }
    default: {
      return `updateElement: "${field}" is derived and cannot be patched`
    }
  }
}

function willBeBound(element: CanvasElement, patch: ElementPatch): boolean {
  if (element.type !== "text") {
    return false
  }
  const containerId = (patch as Partial<TextElement>).containerId
  if (containerId !== undefined) {
    return containerId !== null
  }
  return element.containerId !== null && element.containerId !== undefined
}

function isAncestor(
  index: GroupIndex,
  id: ElementId,
  candidate: ElementId,
): boolean {
  const seen = new Set<ElementId>()
  let current = index.parentById.get(id)
  while (current && !seen.has(current)) {
    if (current === candidate) {
      return true
    }
    seen.add(current)
    current = index.parentById.get(current)
  }
  return false
}

function validateBinding(
  elements: Map<ElementId, CanvasElement>,
  element: CanvasElement,
  field: string,
  value: unknown,
): void {
  if (value === null) {
    return
  }
  if (!isRecord(value)) {
    throw new TypeError(
      `updateElement: "${field}" must be an ArrowBinding or null`,
    )
  }
  assertString(value.elementId, `${field}.elementId`)
  if (value.elementId === element.id) {
    throw new TypeError(
      `updateElement: "${field}" cannot bind an arrow to itself`,
    )
  }
  const target = elements.get(value.elementId)
  if (!target || !isBindableElement(target)) {
    throw new TypeError(
      `updateElement: "${field}" target "${value.elementId}" does not exist or is not bindable`,
    )
  }
  if (value.focus !== undefined) {
    assertFiniteNumber(value.focus, `${field}.focus`)
  }
}

function validateChildren(
  elements: Map<ElementId, CanvasElement>,
  group: GroupElement,
  value: unknown,
): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(
      'updateElement: "children" must be a non-empty array of element ids; use ungroup() to remove the group',
    )
  }

  const index = createGroupIndex(elements)
  const seen = new Set<ElementId>()
  for (const childId of value) {
    if (typeof childId !== "string" || childId.length === 0) {
      throw new TypeError(
        'updateElement: "children" must contain element ids as strings',
      )
    }
    if (seen.has(childId)) {
      throw new TypeError(
        `updateElement: "children" contains "${childId}" more than once`,
      )
    }
    seen.add(childId)

    if (childId === group.id) {
      throw new TypeError("updateElement: a group cannot contain itself")
    }
    if (!elements.has(childId)) {
      throw new TypeError(
        `updateElement: "children" references missing element "${childId}"`,
      )
    }
    const parent = index.parentById.get(childId)
    if (parent && parent !== group.id) {
      throw new TypeError(
        `updateElement: "${childId}" already belongs to group "${parent}"`,
      )
    }
    if (isAncestor(index, group.id, childId)) {
      throw new TypeError(
        `updateElement: "${childId}" is an ancestor of the group`,
      )
    }
  }
}

function validateField(
  elements: Map<ElementId, CanvasElement>,
  element: CanvasElement,
  field: string,
  value: unknown,
): void {
  switch (field) {
    case "x":
    case "y":
    case "rotation":
    case "zIndex":
    case "startX":
    case "startY":
    case "endX":
    case "endY":
    case "cornerRadius":
    case "strokeWidth":
    case "fontSize":
    case "lineHeight":
    case "padding":
    case "naturalWidth":
    case "naturalHeight": {
      assertFiniteNumber(value, field)
      if (
        (field === "cornerRadius" ||
          field === "strokeWidth" ||
          field === "padding") &&
        value < 0
      ) {
        throw new RangeError(`updateElement: "${field}" cannot be negative`)
      }
      if (
        (field === "fontSize" ||
          field === "lineHeight" ||
          field === "naturalWidth" ||
          field === "naturalHeight") &&
        value <= 0
      ) {
        throw new RangeError(`updateElement: "${field}" must be greater than 0`)
      }
      break
    }
    case "width":
    case "height": {
      assertFiniteNumber(value, field)
      if (value < 1) {
        throw new RangeError(`updateElement: "${field}" must be at least 1`)
      }
      break
    }
    case "opacity": {
      assertFiniteNumber(value, field)
      if (value < 0 || value > 1) {
        throw new RangeError('updateElement: "opacity" must be between 0 and 1')
      }
      break
    }
    case "smoothing": {
      assertFiniteNumber(value, field)
      if (value < 0 || value > 1) {
        throw new RangeError(
          'updateElement: "smoothing" must be between 0 and 1',
        )
      }
      break
    }
    case "labelPosition": {
      if (value === null) {
        break
      }
      assertFiniteNumber(value, field)
      if (value < 0 || value > 1) {
        throw new RangeError(
          'updateElement: "labelPosition" must be between 0 and 1 or null',
        )
      }
      break
    }
    case "wrapWidth": {
      if (value === null) {
        break
      }
      assertFiniteNumber(value, field)
      if (value <= 0) {
        throw new RangeError(
          'updateElement: "wrapWidth" must be greater than 0 or null',
        )
      }
      break
    }
    case "locked":
    case "visible":
    case "autoSize":
    case "startArrowhead":
    case "endArrowhead": {
      assertBoolean(value, field)
      break
    }
    case "strokeColor":
    case "fillColor":
    case "fontFamily":
    case "src":
    case "mimeType":
    case "text": {
      assertString(value, field)
      break
    }
    case "textAlign": {
      if (value !== "left" && value !== "center" && value !== "right") {
        throw new TypeError(
          'updateElement: "textAlign" must be "left", "center" or "right"',
        )
      }
      break
    }
    case "containerId": {
      if (value === null) {
        break
      }
      assertString(value, field)
      const target = elements.get(value)
      if (!target || !isBoundTextContainer(target)) {
        throw new TypeError(
          `updateElement: "containerId" target "${value}" does not exist or cannot own bound text`,
        )
      }
      if (value === element.id) {
        throw new TypeError("updateElement: text cannot be bound to itself")
      }
      break
    }
    case "points": {
      if (!Array.isArray(value) || value.length < 2) {
        throw new TypeError(
          'updateElement: "points" must contain at least two points',
        )
      }
      for (const [index, point] of value.entries()) {
        if (!isRecord(point)) {
          throw new TypeError(
            `updateElement: "points[${index}]" must be an { x, y } object`,
          )
        }
        assertFiniteNumber(point.x, `points[${index}].x`)
        assertFiniteNumber(point.y, `points[${index}].y`)
      }
      break
    }
    case "startBinding":
    case "endBinding": {
      validateBinding(elements, element, field, value)
      break
    }
    case "children": {
      validateChildren(elements, element as GroupElement, value)
      break
    }
    default: {
      throw new TypeError(`updateElement: "${field}" is not a valid field`)
    }
  }
}

/**
 * Validate an element patch against the current element and element map.
 *
 * @internal
 */
export function validateElementPatch(
  elements: Map<ElementId, CanvasElement>,
  element: CanvasElement,
  patch: ElementPatch,
): void {
  if (!isRecord(patch)) {
    throw new TypeError("updateElement: patch must be an object")
  }
  if ("id" in patch) {
    throw new TypeError('updateElement: "id" cannot be patched')
  }
  if ("type" in patch) {
    throw new TypeError('updateElement: "type" cannot be patched')
  }

  const allowed = FIELDS[element.type]
  for (const field of Object.keys(patch)) {
    if (!allowed.has(field)) {
      throw new TypeError(
        `updateElement: "${field}" is not a valid field for a ${element.type} element`,
      )
    }
  }

  const record = patch as Record<string, unknown>
  if (willBeBound(element, patch)) {
    for (const field of Object.keys(patch)) {
      if (record[field] !== undefined && BOUND_TEXT_DERIVED.has(field)) {
        throw new TypeError(
          `updateElement: "${field}" is derived from the text's container; update the container instead`,
        )
      }
    }
  }

  const derived = DERIVED_FIELDS[element.type]
  if (derived) {
    for (const field of Object.keys(patch)) {
      if (record[field] !== undefined && derived.has(field)) {
        throw new TypeError(derivedMessage(element, field))
      }
    }
  }

  if (
    element.type === "text" &&
    record.width !== undefined &&
    record.autoSize === true
  ) {
    throw new TypeError(
      'updateElement: "width" cannot be combined with "autoSize: true"',
    )
  }

  for (const [field, value] of Object.entries(record)) {
    if (value !== undefined) {
      validateField(elements, element, field, value)
    }
  }
}

function normalizePatch(patch: ElementPatch): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(
    patch as Record<string, unknown>,
  )) {
    if (value === undefined) {
      continue
    }
    switch (field) {
      case "points": {
        normalized[field] = (value as Point[]).map((point) => ({
          x: point.x,
          y: point.y,
        }))
        break
      }
      case "children": {
        normalized[field] = [...(value as ElementId[])]
        break
      }
      case "startBinding":
      case "endBinding": {
        normalized[field] =
          value === null ? null : { ...(value as ArrowBinding) }
        break
      }
      case "rotation": {
        normalized[field] = (value as number) % 360
        break
      }
      default: {
        normalized[field] = value
      }
    }
  }
  return normalized
}

function getMoveDelta(element: CanvasElement, patch: ElementPatch): Point {
  const { x, y } = patch as { x?: number; y?: number }
  return {
    x: x === undefined ? 0 : x - element.x,
    y: y === undefined ? 0 : y - element.y,
  }
}

function getLinearBounds(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { height: number; width: number; x: number; y: number } {
  return {
    height: Math.max(Math.abs(endY - startY), 1),
    width: Math.max(Math.abs(endX - startX), 1),
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
  }
}

function getPointsBounds(points: Point[]): {
  height: number
  width: number
  x: number
  y: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return {
    height: Math.max(maxY - minY, 1),
    width: Math.max(maxX - minX, 1),
    x: minX,
    y: minY,
  }
}

/**
 * Translate an element's geometry by a delta.
 * @internal
 */
export function translateElement(
  element: CanvasElement,
  delta: Point,
): CanvasElement {
  if (element.type === "path") {
    return {
      ...element,
      points: element.points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      })),
      x: element.x + delta.x,
      y: element.y + delta.y,
    }
  }
  if (element.type === "line" || element.type === "arrow") {
    return {
      ...element,
      endX: element.endX + delta.x,
      endY: element.endY + delta.y,
      startX: element.startX + delta.x,
      startY: element.startY + delta.y,
      x: element.x + delta.x,
      y: element.y + delta.y,
    }
  }
  return {
    ...element,
    x: element.x + delta.x,
    y: element.y + delta.y,
  }
}

function applyLinearPatch(
  elements: Map<ElementId, CanvasElement>,
  element: LineElement | ArrowElement,
  patch: ElementPatch,
  normalized: Record<string, unknown>,
): LineElement | ArrowElement {
  const next = { ...element, ...normalized } as LineElement | ArrowElement
  const delta = getMoveDelta(element, patch)
  const startX = next.startX + delta.x
  const startY = next.startY + delta.y
  const endX = next.endX + delta.x
  const endY = next.endY + delta.y
  const updated = {
    ...next,
    ...getLinearBounds(startX, startY, endX, endY),
    endX,
    endY,
    startX,
    startY,
  }
  return setElement(elements, element, updated)
}

function applyPathPatch(
  elements: Map<ElementId, CanvasElement>,
  element: PathElement,
  patch: ElementPatch<PathElement>,
  normalized: Record<string, unknown>,
): PathElement {
  const next = { ...element, ...normalized } as PathElement
  const delta = getMoveDelta(element, patch)
  let points = next.points
  if (points !== element.points) {
    points = points.map((point) => ({ x: point.x, y: point.y }))
  }
  if (delta.x !== 0 || delta.y !== 0) {
    points = points.map((point) => ({
      x: point.x + delta.x,
      y: point.y + delta.y,
    }))
  }

  const updated =
    points.length === 0
      ? {
          ...next,
          points,
          x: element.x + delta.x,
          y: element.y + delta.y,
        }
      : { ...next, points, ...getPointsBounds(points) }
  return setElement(elements, element, updated)
}

function applyTextPatch(
  elements: Map<ElementId, CanvasElement>,
  element: TextElement,
  patch: ElementPatch<TextElement>,
  normalized: Record<string, unknown>,
  measurer: TextMeasurer,
): TextElement {
  let next = { ...element, ...normalized } as TextElement
  const wasBound =
    element.containerId !== null && element.containerId !== undefined
  const bound = next.containerId !== null && next.containerId !== undefined
  if (bound) {
    // syncTextBindings re-wraps, centers and sizes bound text after the commit.
    // Measure here as well so programmatic text or font changes are reflected
    // even when the wrapping configuration itself did not change.
    const layout = measureTextElement(next, measurer)
    next = { ...next, height: layout.height, width: layout.width }
    return setElement(elements, element, next)
  }

  // Unbinding turns the text back into free text: auto-size it unless the
  // caller asked for a fixed width.
  if (wasBound) {
    next = {
      ...next,
      autoSize: patch.autoSize ?? true,
      wrapWidth: null,
    }
  }

  if (
    patch.width !== undefined &&
    patch.autoSize === undefined &&
    next.autoSize !== false
  ) {
    next = { ...next, autoSize: false }
  }
  if (patch.width !== undefined) {
    next = { ...next, wrapWidth: null }
  }

  const layout = measureTextElement(next, measurer)
  next = { ...next, height: layout.height, width: layout.width }
  return setElement(elements, element, next)
}

function applyNotePatch(
  elements: Map<ElementId, CanvasElement>,
  element: NoteElement,
  normalized: Record<string, unknown>,
  measurer: TextMeasurer,
): NoteElement {
  let next = { ...element, ...normalized } as NoteElement
  const minHeight = getNoteMinHeight(next, measurer)
  if (next.height < minHeight) {
    next = { ...next, height: minHeight }
  }
  return setElement(elements, element, next)
}

function applyGroupPatch(
  elements: Map<ElementId, CanvasElement>,
  element: GroupElement,
  patch: ElementPatch<GroupElement>,
  normalized: Record<string, unknown>,
  measurer: TextMeasurer,
): GroupElement {
  let next = { ...element, ...normalized } as GroupElement
  elements.set(element.id, next)

  const delta = getMoveDelta(element, patch)
  if (delta.x !== 0 || delta.y !== 0) {
    const index = createGroupIndex(elements)
    for (const leafId of getLeafDescendantIds(index, [element.id])) {
      const leaf = elements.get(leafId)
      if (leaf) {
        elements.set(leafId, translateElement(leaf, delta))
      }
    }
  }

  if (patch.opacity !== undefined) {
    const index = createGroupIndex(elements)
    for (const leafId of getLeafDescendantIds(index, [element.id])) {
      const leaf = elements.get(leafId)
      if (leaf) {
        const styled = applyStyleToElement(
          leaf,
          { opacity: patch.opacity },
          measurer,
        )
        if (styled !== leaf) {
          elements.set(leafId, styled)
        }
      }
    }
  }

  if (patch.zIndex !== undefined) {
    const nextElements = setElementZIndex(elements, element.id, patch.zIndex)
    if (nextElements) {
      elements.clear()
      for (const [id, value] of nextElements) {
        elements.set(id, value)
      }
    }
  }

  next = elements.get(element.id) as GroupElement
  if (sameElement(element, next)) {
    elements.set(element.id, element)
    return element
  }
  return next
}

/**
 * Apply a validated patch to one element in the draft map.
 *
 * @internal
 */
export function applyElementPatch(
  elements: Map<ElementId, CanvasElement>,
  element: CanvasElement,
  patch: ElementPatch,
  measurer: TextMeasurer,
): CanvasElement {
  const normalized = normalizePatch(patch)
  if (Object.keys(normalized).length === 0) {
    return element
  }

  switch (element.type) {
    case "arrow":
    case "line": {
      return applyLinearPatch(elements, element, patch, normalized)
    }
    case "group": {
      return applyGroupPatch(
        elements,
        element,
        patch as ElementPatch<GroupElement>,
        normalized,
        measurer,
      )
    }
    case "note": {
      return applyNotePatch(elements, element, normalized, measurer)
    }
    case "path": {
      return applyPathPatch(
        elements,
        element,
        patch as ElementPatch<PathElement>,
        normalized,
      )
    }
    case "text": {
      return applyTextPatch(
        elements,
        element,
        patch as ElementPatch<TextElement>,
        normalized,
        measurer,
      )
    }
    default: {
      const next = { ...element, ...normalized } as CanvasElement
      return setElement(elements, element, next)
    }
  }
}
