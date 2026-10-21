import { syncArrowBindings } from "../bindings"
import { TEXT_CONTAINER_SNAP_THRESHOLD } from "../constants"
import { createText, getElementAtPoint, getNextZIndex } from "../elements"
import type { CanvasEngine } from "../engine/engine"
import {
  findBoundText,
  getBoundTextMaxWidth,
  isBoundTextContainer,
  syncTextBindings,
  type BoundTextContainer,
} from "../text-bindings"
import type { CanvasElement, ElementId, Point, TextElement } from "../types"
import type { DomState } from "./state"
import { startExistingTextEditing } from "./text-editor"

/**
 * What a text-tool click (or a double-click with the select tool) resolves to.
 */
export type TextTarget =
  | { kind: "text"; element: TextElement }
  | { kind: "bound"; container: BoundTextContainer }
  | { kind: "free" }

/**
 * Resolve what a text-tool click at `point` should do: edit a text, create or
 * edit a label inside a container near its center, or create free text. Arrow
 * labels are created wherever the line is hit.
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
  if (hit.type === "text") {
    return { element: hit, kind: "text" }
  }
  if (hit.type === "arrow") {
    return { container: hit, kind: "bound" }
  }
  if (hit.type === "rectangle" || hit.type === "ellipse") {
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
  const options = engine.getToolOptions("text")
  const text = createText({
    autoSize: true,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    height: options.fontSize * options.lineHeight,
    lineHeight: options.lineHeight,
    locked: false,
    opacity: options.opacity ?? 1,
    rotation: 0,
    strokeColor: options.strokeColor,
    text: "",
    textAlign: options.textAlign ?? "left",
    visible: true,
    width: 1,
    x: point.x,
    y: point.y,
    zIndex: getNextZIndex(elements.values()),
  })

  elements.set(text.id, text)
  engine.emit("change", { elements })
  startExistingTextEditing(state, engine, text)
  return true
}

/**
 * Start editing a container's label, creating an empty centered label first
 * when the container does not have one yet. The label is inserted without a
 * history checkpoint; committing the edit records the insertion and any
 * container growth as a single undoable change.
 *
 * @param state DOM adapter state.
 * @param engine Canvas engine.
 * @param container Live rectangle, ellipse or arrow.
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

  const existing = findBoundText(elements, live.id)
  if (existing) {
    startExistingTextEditing(state, engine, existing)
    return true
  }

  const options = engine.getToolOptions("text")
  const isArrow = live.type === "arrow"
  const maxWidth = isArrow ? null : getBoundTextMaxWidth(live, options.fontSize)
  const text = createText({
    autoSize: isArrow,
    containerId: live.id,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    height: options.fontSize * options.lineHeight,
    labelPosition: isArrow ? 0.5 : null,
    lineHeight: options.lineHeight,
    locked: false,
    opacity: options.opacity ?? 1,
    rotation: 0,
    strokeColor: options.strokeColor,
    text: "",
    textAlign: "center",
    visible: true,
    width: 1,
    wrapWidth: maxWidth,
    x: 0,
    y: 0,
    zIndex: live.zIndex + 0.5,
  })

  elements.set(text.id, text)
  syncTextBindings(elements, engine.getTextMeasurer())
  syncArrowBindings(elements)
  const positioned = elements.get(text.id)
  if (positioned?.type !== "text") {
    return false
  }

  engine.emit("change", { elements })
  startExistingTextEditing(state, engine, positioned)
  return true
}
