import { describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import {
  createArrow,
  createGroup,
  createLine,
  createPath,
  createRectangle,
  createText,
} from "../elements"
import { AdrawStore } from "../store"
import type {
  ArrowElement,
  CanvasElement,
  GroupElement,
  LineElement,
  PathElement,
  RectangleElement,
  TextElement,
} from "../types"

function rectangle(
  id: string,
  overrides: Partial<RectangleElement> = {},
): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 20,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    visible: true,
    width: 20,
    x: 0,
    y: 0,
    zIndex: 1,
    ...overrides,
  })
}

function line(id: string): LineElement {
  return createLine({
    endX: 100,
    endY: 50,
    height: 50,
    id,
    locked: false,
    rotation: 0,
    startX: 0,
    startY: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    zIndex: 1,
  })
}

function path(id: string): PathElement {
  return createPath({
    height: 10,
    id,
    locked: false,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    rotation: 0,
    smoothing: 0.5,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 10,
    x: 0,
    y: 0,
    zIndex: 1,
  })
}

function text(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return createText({
    autoSize: true,
    fontSize: 20,
    height: 25,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    text: "Hello",
    visible: true,
    width: 60,
    x: 0,
    y: 0,
    zIndex: 2,
    ...overrides,
  })
}

function group(
  id: string,
  children: string[],
  overrides: Partial<GroupElement> = {},
): GroupElement {
  return createGroup({
    children,
    height: 0,
    id,
    locked: false,
    rotation: 0,
    visible: true,
    width: 0,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

function setup(elements: CanvasElement[]): AdrawCanvas {
  const canvas = new AdrawCanvas()
  canvas.addElement(elements, { history: false })
  canvas.clearHistory()
  return canvas
}

describe("nudge", () => {
  it("moves one element and records one checkpoint and one publication", () => {
    const canvas = setup([rectangle("a", { x: 10, y: 20 })])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    const moved = canvas.nudge("a", { x: 5, y: -3 })

    expect(moved.map((element) => element.id)).toEqual(["a"])
    expect(canvas.getElements().get("a")).toMatchObject({ x: 15, y: 17 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()
    expect(canvas.getElements().get("a")).toMatchObject({ x: 10, y: 20 })
    store.dispose()
  })

  it("moves the current selection by default", () => {
    const canvas = setup([rectangle("a"), rectangle("b", { x: 40, zIndex: 2 })])
    canvas.setSelectedIds(new Set(["a", "b"]))

    const moved = canvas.nudge(undefined, { x: 1, y: 0 })

    expect(moved.map((element) => element.id)).toEqual(["a", "b"])
    expect(canvas.getElements().get("a")?.x).toBe(1)
    expect(canvas.getElements().get("b")?.x).toBe(41)
  })

  it("translates line endpoints and path points", () => {
    const canvas = setup([line("line"), path("path")])
    canvas.setSelectedIds(new Set(["line", "path"]))

    canvas.nudge(undefined, { x: 5, y: -2 })

    expect(canvas.getElements().get("line")).toMatchObject({
      endX: 105,
      endY: 48,
      startX: 5,
      startY: -2,
      x: 5,
      y: -2,
    })
    const movedPath = canvas.getElements().get("path") as PathElement
    expect(movedPath.points).toEqual([
      { x: 5, y: -2 },
      { x: 15, y: 8 },
    ])
    expect(movedPath).toMatchObject({ x: 5, y: -2 })
  })

  it("moves a group subtree once even when a child is also selected", () => {
    const canvas = setup([
      rectangle("a"),
      rectangle("b", { x: 40, zIndex: 2 }),
      group("group", ["a", "b"]),
    ])
    canvas.setSelectedIds(new Set(["group", "a"]))

    const moved = canvas.nudge(undefined, { x: 10, y: 5 })

    expect(moved.map((element) => element.id)).toEqual(["group", "a"])
    expect(canvas.getElements().get("a")).toMatchObject({ x: 10, y: 5 })
    expect(canvas.getElements().get("b")).toMatchObject({ x: 50, y: 5 })
    expect(canvas.getElements().get("group")).toMatchObject({
      x: 10,
      y: 5,
    })
  })

  it("lets bound text follow its container", () => {
    const canvas = setup([
      rectangle("container", { height: 100, width: 100 }),
      text("label", { containerId: "container", text: "Hi" }),
    ])
    const before = canvas.getElements().get("label") as TextElement
    canvas.setSelectedIds(new Set(["container", "label"]))

    canvas.nudge(undefined, { x: 10, y: 10 })

    const after = canvas.getElements().get("label") as TextElement
    expect(after.x).toBeCloseTo(before.x + 10)
    expect(after.y).toBeCloseTo(before.y + 10)
  })

  it("does not move bound text when only the text is selected", () => {
    const canvas = setup([
      rectangle("container", { height: 100, width: 100 }),
      text("label", { containerId: "container", text: "Hi" }),
    ])
    const before = canvas.getElements().get("label") as TextElement

    const moved = canvas.nudge("label", { x: 10, y: 0 })

    expect(moved).toHaveLength(1)
    expect((canvas.getElements().get("label") as TextElement).x).toBeCloseTo(
      before.x,
    )
    expect(canvas.canUndo()).toBe(false)
  })

  it("detaches arrow bindings whose targets are outside the moving set", () => {
    const canvas = setup([
      rectangle("target"),
      createArrow({
        endArrowhead: true,
        endBinding: { elementId: "target" },
        endX: 50,
        endY: 10,
        height: 1,
        id: "arrow",
        locked: false,
        rotation: 0,
        startArrowhead: false,
        startBinding: null,
        startX: -50,
        startY: 10,
        strokeColor: "#000",
        strokeWidth: 1,
        visible: true,
        width: 100,
        x: -50,
        y: 10,
        zIndex: 2,
      }),
    ])
    canvas.setSelectedIds(new Set(["arrow"]))

    canvas.nudge(undefined, { x: 10, y: 0 })

    const arrow = canvas.getElements().get("arrow") as ArrowElement
    expect(arrow.endBinding).toBeNull()
    expect(arrow.endX).toBe(6)
  })

  it("keeps arrow bindings when the target moves with the arrow", () => {
    const canvas = setup([
      rectangle("target"),
      createArrow({
        endArrowhead: true,
        endBinding: { elementId: "target" },
        endX: 50,
        endY: 10,
        height: 1,
        id: "arrow",
        locked: false,
        rotation: 0,
        startArrowhead: false,
        startBinding: null,
        startX: -50,
        startY: 10,
        strokeColor: "#000",
        strokeWidth: 1,
        visible: true,
        width: 100,
        x: -50,
        y: 10,
        zIndex: 2,
      }),
    ])
    canvas.setSelectedIds(new Set(["target", "arrow"]))

    canvas.nudge(undefined, { x: 10, y: 0 })

    const arrow = canvas.getElements().get("arrow") as ArrowElement
    expect(arrow.endBinding).toEqual({ elementId: "target" })
    expect(canvas.getElements().get("target")?.x).toBe(10)
  })

  it("returns nothing for an empty selection or a zero delta", () => {
    const canvas = setup([rectangle("a")])
    const store = new AdrawStore(canvas)
    const revision = store.getSnapshot().revision

    expect(canvas.nudge(undefined, { x: 1, y: 0 })).toEqual([])
    expect(canvas.nudge("a", { x: 0, y: 0 })).toEqual([])
    expect(store.getSnapshot().revision).toBe(revision)
    expect(canvas.canUndo()).toBe(false)
    store.dispose()
  })

  it("supports { history: false } and keeps the move across undo", () => {
    const canvas = setup([rectangle("a")])

    canvas.nudge("a", { x: 5, y: 0 }, { history: false })
    expect(canvas.canUndo()).toBe(false)

    canvas.addElement(rectangle("b", { x: 40 }))
    canvas.undo()

    expect(canvas.getElements().get("a")?.x).toBe(5)
    expect(canvas.getElements().has("b")).toBe(false)
  })

  it("rejects non-finite deltas", () => {
    const canvas = setup([rectangle("a")])

    expect(() => canvas.nudge("a", { x: Number.NaN, y: 0 })).toThrow(/finite/)
    expect(canvas.canUndo()).toBe(false)
  })
})
