import { describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import {
  createArrow,
  createGroup,
  createRectangle,
  createText,
} from "../elements"
import { AdrawStore } from "../store"
import type {
  Alignment,
  ArrowElement,
  CanvasElement,
  DistributeAxis,
  GroupElement,
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

describe("align", () => {
  it.each([
    ["left", { a: { x: 0 }, b: { x: 0 } }],
    ["center", { a: { x: 15 }, b: { x: 20 } }],
    ["right", { a: { x: 30 }, b: { x: 40 } }],
    ["top", { a: { y: 0 }, b: { y: 0 } }],
    ["middle", { a: { y: 10 }, b: { y: 15 } }],
    ["bottom", { a: { y: 20 }, b: { y: 30 } }],
  ] as const)("aligns %s", (alignment, expected) => {
    const canvas = setup([
      rectangle("a"),
      rectangle("b", { height: 10, width: 10, x: 40, y: 30 }),
    ])

    const moved = canvas.align(["a", "b"], alignment as Alignment)

    expect(moved.map((element) => element.id)).toEqual(["a", "b"])
    expect(canvas.getElements().get("a")).toMatchObject(expected.a)
    expect(canvas.getElements().get("b")).toMatchObject(expected.b)
  })

  it("records one checkpoint and one publication", () => {
    const canvas = setup([rectangle("a"), rectangle("b", { x: 40 })])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)
    const revision = store.getSnapshot().revision

    canvas.align(["a", "b"], "left")

    expect(canvas.getElements().get("b")?.x).toBe(0)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().revision).toBe(revision + 1)
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()
    expect(canvas.getElements().get("b")?.x).toBe(40)
    store.dispose()
  })

  it("does not record history for a single target", () => {
    const canvas = setup([rectangle("a")])

    const moved = canvas.align("a", "right")

    expect(moved.map((element) => element.id)).toEqual(["a"])
    expect(canvas.canUndo()).toBe(false)
  })

  it("aligns groups as a unit and skips selected descendants", () => {
    const canvas = setup([
      rectangle("a"),
      rectangle("b", { x: 40, zIndex: 2 }),
      group("group", ["a", "b"]),
      rectangle("c", { x: 100, y: 100, zIndex: 3 }),
    ])
    canvas.setSelectedIds(new Set(["group", "a", "c"]))

    const moved = canvas.align(undefined, "right")

    expect(moved.map((element) => element.id)).toEqual(["group", "c"])
    expect(canvas.getElements().get("a")?.x).toBe(60)
    expect(canvas.getElements().get("b")?.x).toBe(100)
    expect(canvas.getElements().get("group")).toMatchObject({
      width: 60,
      x: 60,
    })
    expect(canvas.getElements().get("c")?.x).toBe(100)
  })

  it("skips locked and hidden targets", () => {
    const canvas = setup([
      rectangle("a"),
      rectangle("b", { x: 40 }),
      rectangle("locked", { locked: true, x: 80 }),
      rectangle("hidden", { visible: false, x: 120 }),
    ])
    canvas.setSelectedIds(new Set(["a", "b", "locked", "hidden"]))

    const moved = canvas.align(undefined, "left")

    expect(moved.map((element) => element.id)).toEqual(["a", "b"])
    expect(canvas.getElements().get("a")?.x).toBe(0)
    expect(canvas.getElements().get("b")?.x).toBe(0)
    expect(canvas.getElements().get("locked")?.x).toBe(80)
    expect(canvas.getElements().get("hidden")?.x).toBe(120)
  })

  it("moves bound text with its container", () => {
    const canvas = setup([
      rectangle("container", { height: 100, width: 100 }),
      text("label", { containerId: "container", text: "Hi" }),
      rectangle("other", { x: 200, zIndex: 2 }),
    ])
    const before = canvas.getElements().get("label") as TextElement
    canvas.setSelectedIds(new Set(["container", "other"]))

    canvas.align(undefined, "right")

    const after = canvas.getElements().get("label") as TextElement
    expect(after.x - before.x).toBeCloseTo(120)
  })

  it("ignores bound text as an independent target", () => {
    const canvas = setup([
      rectangle("container", { height: 100, width: 100 }),
      text("label", { containerId: "container", text: "Hi" }),
    ])

    const moved = canvas.align("label", "left")

    expect(moved).toEqual([])
    expect(canvas.canUndo()).toBe(false)
  })

  it("keeps arrow bindings coherent when the target moves", () => {
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
      rectangle("other", { x: 100, zIndex: 3 }),
    ])
    canvas.setSelectedIds(new Set(["target", "other"]))

    canvas.align(undefined, "right")

    const arrow = canvas.getElements().get("arrow") as ArrowElement
    expect(arrow.endBinding).toEqual({ elementId: "target" })
    expect(canvas.getElements().get("target")?.x).toBe(100)
    expect(arrow.endX).toBeGreaterThan(50)
  })

  it("supports { history: false }", () => {
    const canvas = setup([rectangle("a"), rectangle("b", { x: 40 })])

    canvas.align(["a", "b"], "left", { history: false })
    expect(canvas.canUndo()).toBe(false)

    canvas.addElement(rectangle("c", { x: 80 }))
    canvas.undo()

    expect(canvas.getElements().get("b")?.x).toBe(0)
    expect(canvas.getElements().has("c")).toBe(false)
  })

  it("rejects unknown alignments", () => {
    const canvas = setup([rectangle("a")])

    expect(() => canvas.align("a", "diagonal" as Alignment)).toThrow(
      /alignment/,
    )
  })
})

describe("distribute", () => {
  it("distributes horizontally with equal gaps", () => {
    const canvas = setup([
      rectangle("a", { width: 10 }),
      rectangle("b", { width: 20, x: 30 }),
      rectangle("c", { width: 10, x: 100 }),
    ])

    const moved = canvas.distribute(["a", "b", "c"], "horizontal")

    expect(moved.map((element) => element.id)).toEqual(["a", "b", "c"])
    expect(canvas.getElements().get("a")?.x).toBe(0)
    expect(canvas.getElements().get("b")?.x).toBe(45)
    expect(canvas.getElements().get("c")?.x).toBe(100)
  })

  it("distributes vertically with equal gaps", () => {
    const canvas = setup([
      rectangle("a", { height: 10 }),
      rectangle("b", { height: 20, y: 30 }),
      rectangle("c", { height: 10, y: 100 }),
    ])

    canvas.distribute(["a", "b", "c"], "vertical")

    expect(canvas.getElements().get("a")?.y).toBe(0)
    expect(canvas.getElements().get("b")?.y).toBe(45)
    expect(canvas.getElements().get("c")?.y).toBe(100)
  })

  it("does nothing with fewer than three targets", () => {
    const canvas = setup([rectangle("a"), rectangle("b", { x: 40 })])
    const store = new AdrawStore(canvas)
    const revision = store.getSnapshot().revision

    const moved = canvas.distribute(["a", "b"], "horizontal")

    expect(moved.map((element) => element.id)).toEqual(["a", "b"])
    expect(store.getSnapshot().revision).toBe(revision)
    expect(canvas.canUndo()).toBe(false)
    store.dispose()
  })

  it("moves groups as units", () => {
    const canvas = setup([
      rectangle("a1"),
      rectangle("a2", { x: 10, zIndex: 2 }),
      group("g1", ["a1", "a2"]),
      rectangle("b1", { x: 40 }),
      rectangle("b2", { x: 50, zIndex: 2 }),
      group("g2", ["b1", "b2"], { zIndex: 2 }),
      rectangle("c1", { x: 100 }),
      rectangle("c2", { x: 110, zIndex: 2 }),
      group("g3", ["c1", "c2"], { zIndex: 3 }),
    ])

    canvas.distribute(["g1", "g2", "g3"], "horizontal")

    expect(canvas.getElements().get("g1")?.x).toBe(0)
    expect(canvas.getElements().get("g2")?.x).toBe(50)
    expect(canvas.getElements().get("g3")?.x).toBe(100)
    expect(canvas.getElements().get("b1")?.x).toBe(50)
    expect(canvas.getElements().get("b2")?.x).toBe(60)
  })

  it("skips locked targets", () => {
    const canvas = setup([
      rectangle("a", { width: 10 }),
      rectangle("b", { width: 10, x: 20 }),
      rectangle("c", { width: 10, x: 60 }),
      rectangle("locked", { locked: true, width: 10, x: 90 }),
    ])
    canvas.setSelectedIds(new Set(["a", "b", "c", "locked"]))

    canvas.distribute(undefined, "horizontal")

    expect(canvas.getElements().get("a")?.x).toBe(0)
    expect(canvas.getElements().get("b")?.x).toBe(30)
    expect(canvas.getElements().get("c")?.x).toBe(60)
    expect(canvas.getElements().get("locked")?.x).toBe(90)
  })

  it("records one checkpoint and one publication", () => {
    const canvas = setup([
      rectangle("a", { width: 10 }),
      rectangle("b", { width: 20, x: 30 }),
      rectangle("c", { width: 10, x: 100 }),
    ])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)
    const revision = store.getSnapshot().revision

    canvas.distribute(["a", "b", "c"], "horizontal")

    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot().revision).toBe(revision + 1)
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()
    expect(canvas.getElements().get("b")?.x).toBe(30)
    store.dispose()
  })

  it("supports { history: false }", () => {
    const canvas = setup([
      rectangle("a", { width: 10 }),
      rectangle("b", { width: 20, x: 30 }),
      rectangle("c", { width: 10, x: 100 }),
    ])

    canvas.distribute(["a", "b", "c"], "horizontal", {
      history: false,
    })
    expect(canvas.canUndo()).toBe(false)

    canvas.addElement(rectangle("d", { x: 160 }))
    canvas.undo()

    expect(canvas.getElements().get("b")?.x).toBe(45)
    expect(canvas.getElements().has("d")).toBe(false)
  })

  it("rejects unknown axes", () => {
    const canvas = setup([rectangle("a")])

    expect(() => canvas.distribute("a", "diagonal" as DistributeAxis)).toThrow(
      /axis/,
    )
  })
})
