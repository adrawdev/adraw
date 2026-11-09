import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import {
  createArrow,
  createGroup,
  createRectangle,
  createText,
} from "../elements"
import { AdrawStore } from "../store"
import type {
  ArrowElement,
  CanvasElement,
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

describe("duplicate", () => {
  it("duplicates the selection with the default offset", () => {
    const canvas = setup([rectangle("a", { x: 10, y: 20 })])
    canvas.setSelectedIds(new Set(["a"]))

    const clones = canvas.duplicate()

    expect(clones).toHaveLength(1)
    const clone = clones[0] as RectangleElement
    expect(clone.id).not.toBe("a")
    expect(clone).toMatchObject({ x: 30, y: 40 })
    expect(canvas.getElements().size).toBe(2)
    expect([...canvas.getSelectedIds()]).toEqual([clone.id])
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has(clone.id)).toBe(false)
  })

  it("duplicates multiple elements and stacks the clones above the content", () => {
    const canvas = setup([
      rectangle("a", { zIndex: 1 }),
      rectangle("b", { x: 40, zIndex: 2 }),
    ])
    canvas.setSelectedIds(new Set(["a", "b"]))

    const clones = canvas.duplicate()

    expect(clones).toHaveLength(2)
    expect(clones.map((element) => element.x)).toEqual([20, 60])
    expect(clones.map((element) => element.zIndex)).toEqual([3, 4])
    expect(canvas.getElements().size).toBe(4)
    expect(canvas.getSelectedIds().size).toBe(2)
  })

  it("remaps group children and bound text containers", () => {
    const canvas = setup([
      rectangle("rect", { height: 100, width: 100, zIndex: 1 }),
      text("label", { containerId: "rect", text: "Hi", zIndex: 2 }),
      group("group", ["rect", "label"]),
    ])
    canvas.setSelectedIds(new Set(["group"]))

    const clones = canvas.duplicate()

    expect(clones).toHaveLength(3)
    const clonedGroup = clones.find(
      (element) => element.type === "group",
    ) as GroupElement
    const clonedRect = clones.find(
      (element) => element.type === "rectangle",
    ) as RectangleElement
    const clonedText = clones.find(
      (element) => element.type === "text",
    ) as TextElement

    expect(clonedGroup.children).toEqual([clonedRect.id, clonedText.id])
    expect(clonedText.containerId).toBe(clonedRect.id)
    expect(clonedGroup).toMatchObject({ height: 100, width: 100, x: 20, y: 20 })
    expect(clonedRect).toMatchObject({ x: 20, y: 20 })
    expect(canvas.getElements().get("group")).toMatchObject({ x: 0, y: 0 })
  })

  it("remaps arrow bindings to duplicated targets", () => {
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

    const clones = canvas.duplicate()

    const clonedTarget = clones.find(
      (element) => element.type === "rectangle",
    ) as RectangleElement
    const clonedArrow = clones.find(
      (element) => element.type === "arrow",
    ) as ArrowElement
    expect(clonedArrow.endBinding).toEqual({ elementId: clonedTarget.id })
  })

  it("drops bindings to targets outside the duplicated set", () => {
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

    const clones = canvas.duplicate()

    const clonedArrow = clones[0] as ArrowElement
    expect(clonedArrow.endBinding).toBeNull()
  })

  it("accepts an explicit id and an offset", () => {
    const canvas = setup([rectangle("a", { x: 10, y: 20 })])

    const clones = canvas.duplicate("a", { offset: { x: 5, y: -5 } })

    expect(clones).toHaveLength(1)
    expect(clones[0]).toMatchObject({ x: 15, y: 15 })
  })

  it("returns empty and records no history when there is nothing to duplicate", () => {
    const canvas = setup([rectangle("a")])
    const store = new AdrawStore(canvas)
    const revision = store.getSnapshot().revision

    expect(canvas.duplicate()).toEqual([])
    expect(store.getSnapshot().revision).toBe(revision)
    expect(canvas.canUndo()).toBe(false)
    store.dispose()
  })

  it("supports { history: false } and keeps the clone across undo", () => {
    const canvas = setup([rectangle("a")])

    const clones = canvas.duplicate("a", { history: false })
    expect(canvas.canUndo()).toBe(false)

    canvas.addElement(rectangle("b", { x: 40 }))
    canvas.undo()

    expect(canvas.getElements().has(clones[0].id)).toBe(true)
    expect(canvas.getElements().has("b")).toBe(false)
  })

  it("rejects a non-finite offset without mutating the canvas", () => {
    const canvas = setup([rectangle("a")])

    expect(() =>
      canvas.duplicate("a", { offset: { x: Number.NaN, y: 0 } }),
    ).toThrow(/finite/)
    expect(canvas.getElements().size).toBe(1)
    expect(canvas.canUndo()).toBe(false)
  })
})
