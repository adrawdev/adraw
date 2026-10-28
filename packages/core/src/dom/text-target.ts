import {
  STROKE_COLOR,
  TEXT_CONTAINER_SNAP_THRESHOLD,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
} from "../constants"
import { createText, getElementAtPoint, getNextZIndex } from "../elements"
import type { CanvasEngine } from "../engine/engine"
import { createGroupIndex, getParentGroupId } from "../groups"
import {
  findBoundText,
  getBoundTextMaxWidth,
  isBoundTextContainer,
  type BoundTextContainer,
} from "../text-bindings"
import type {
  CanvasElement,
  EditableTextElement,
  ElementId,
  Point,
} from "../types"
import type { DomState } from "./state"
import { startExistingTextEditing } from "./text-editor"

/**
 * What a text-tool click (or a double-click with the select tool) resolves to.
 */
export type TextTarget =
  | { kind: "text"; element: EditableTextElement }
  | { kind: "bound"; container: BoundTextContainer }
  | { kind: "free" }

/**
 * Resolve what a text-tool click at `point` should do: edit a text, create or
 * edit bound text inside a container near its center, or create free text.
 * Arrow-bound text is created wherever the line is hit.
 *
 * @param elements Current element map.
 * @param point Canvas-space click point.
 * @param zoom Current viewport zoom (the center threshold is screen-based).
 * @returns The resolved target.
 */
export function resolveTextTarget(
  elements: ReadonlyMap<ElementId, CanvasElement>,
  point: Point,
  zoom: number,
): TextTarget {
  const hit = getElementAtPoint(new Map(elements), point)
  if (!hit) {
    return { kind: "free" }
  }
  if (hit.type === "text" || hit.type === "note") {
    return { element: hit, kind: "text" }
  }
  if (hit.type === "arrow") {
    return { container: hit, kind: "bound" }
  }
  if (
    hit.type === "rectangle" ||
    hit.type === "ellipse" ||
    hit.type === "diamond"
  ) {
    const centerX = hit.x + hit.width / 2
    const centerY = hit.y + hit.height / 2
    const threshold = TEXT_CONTAINER_SNAP_THRESHOLD / Math.max(zoom, 0.01)
    if (Math.hypot(point.x - centerX, point.y - centerY) <= threshold) {
      return { container: hit, kind: "bound" }
    }
  }
  return { kind: "free" }
}

/**
 * Start editing a brand-new free text at `point`. Used by double-clicking the
 * empty canvas, so that path creates the same auto-sized box as the text tool
 * (rather than relying on the text tool's temporary element).
 *
 * @param state DOM adapter state.
 * @param engine Canvas engine.
 * @param point Canvas-space creation point.
 * @returns `true` when an editor was opened.
 */
export function startFreeTextEditing(
  state: DomState,
  engine: CanvasEngine,
  point: { x: number; y: number },
): boolean {
  const elements = engine.getElements()
  const style = engine.getToolContext().getStyle?.() ?? {}
  const fontSize = style.fontSize ?? TEXT_FONT_SIZE
  const lineHeight = style.lineHeight ?? TEXT_LINE_HEIGHT
  const text = createText({
    autoSize: true,
    fontFamily: style.fontFamily ?? TEXT_FONT_FAMILY,
    fontSize,
    height: fontSize * lineHeight,
    lineHeight,
    locked: false,
    opacity: style.opacity ?? 1,
    rotation: 0,
    strokeColor: style.strokeColor ?? STROKE_COLOR,
    text: "",
    textAlign: style.textAlign ?? "left",
    visible: true,
    width: 1,
    x: point.x,
    y: point.y,
    zIndex: getNextZIndex(elements.values()),
  })

  engine.addElement(text, { history: false })
  startExistingTextEditing(state, engine, text)
  return true
}

/**
 * Start editing a container's bound text, creating an empty centered text first
 * when the container does not have one yet. The text is inserted without a
 * history checkpoint; confirming the edit records the insertion and any
 * container growth as a single undoable change.
 *
 * @param state DOM adapter state.
 * @param engine Canvas engine.
 * @param container Live rectangle, ellipse, diamond or arrow.
 * @returns `true` when an editor was opened.
 */
export function startBoundTextEditing(
  state: DomState,
  engine: CanvasEngine,
  container: BoundTextContainer,
): boolean {
  const elements = engine.getElements()
  const live = elements.get(container.id)
  if (!isBoundTextContainer(live)) {
    return false
  }

  // Bound text belongs to the same parent group as its container so it
  // inherits the group's visibility/lock and transforms with it.
  const addBoundTextToContainerGroup = (boundTextId: ElementId): void => {
    const parentId = getParentGroupId(createGroupIndex(elements), live.id)
    if (!parentId) {
      return
    }
    const parent = elements.get(parentId)
    if (parent?.type !== "group" || parent.children.includes(boundTextId)) {
      return
    }
    engine.commitScene(
      (draft) => {
        const current = draft.elements.get(parentId)
        if (
          current?.type === "group" &&
          !current.children.includes(boundTextId)
        ) {
          draft.elements.set(parentId, {
            ...current,
            children: [...current.children, boundTextId],
          })
        }
      },
      { history: false },
    )
  }

  const existing = findBoundText(elements, live.id)
  if (existing) {
    startExistingTextEditing(state, engine, existing)
    return true
  }

  const style = engine.getToolContext().getStyle?.() ?? {}
  const fontSize = style.fontSize ?? TEXT_FONT_SIZE
  const lineHeight = style.lineHeight ?? TEXT_LINE_HEIGHT
  const isArrow = live.type === "arrow"
  const maxWidth = isArrow ? null : getBoundTextMaxWidth(live, fontSize)
  const text = createText({
    autoSize: isArrow,
    containerId: live.id,
    fontFamily: style.fontFamily ?? TEXT_FONT_FAMILY,
    fontSize,
    height: fontSize * lineHeight,
    labelPosition: isArrow ? 0.5 : null,
    lineHeight,
    locked: false,
    opacity: style.opacity ?? 1,
    rotation: 0,
    strokeColor: live.strokeColor ?? style.strokeColor ?? STROKE_COLOR,
    text: "",
    textAlign: "center",
    visible: true,
    width: 1,
    wrapWidth: maxWidth,
    x: 0,
    y: 0,
    zIndex: live.zIndex + 0.5,
  })

  engine.addElement(text, { history: false })
  addBoundTextToContainerGroup(text.id)
  const positioned = engine.getElements().get(text.id)
  if (positioned?.type !== "text") {
    return false
  }

  startExistingTextEditing(state, engine, positioned)
  return true
}
