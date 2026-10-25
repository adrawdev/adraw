import { describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createGroup, createRectangle } from "../elements"
import { AdrawStore } from "../store"
import type { RectangleElement } from "../types"

function makeRect(id: string, zIndex: number): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 10,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    visible: true,
    width: 10,
    x: 0,
    y: 0,
    zIndex,
  })
}

function zIndexes(canvas: AdrawCanvas): Record<string, number> {
  return Object.fromEntries(
    [...canvas.getElements().values()].map((element) => [
      element.id,
      element.zIndex,
    ]),
  )
}

function mediaDescriptor(src = "data:image/png,1") {
  return {
    height: 10,
    mimeType: "image/png",
    naturalHeight: 100,
    naturalWidth: 100,
    src,
    width: 10,
    x: 0,
    y: 0,
  }
}

describe("bringToFront", () => {
  it("moves elements above everything, preserving their relative order", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 0), makeRect("b", 1), makeRect("c", 2)])

    canvas.bringToFront(["a", "b"])

    expect(zIndexes(canvas)).toEqual({ a: 3, b: 4, c: 2 })
  })

  it("accepts a single id", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 0), makeRect("b", 1)])

    canvas.bringToFront("a")

    expect(zIndexes(canvas)).toEqual({ a: 2, b: 1 })
  })

  it("brings a group's children along", () => {
    const canvas = new AdrawCanvas()
    const group = createGroup({
      children: ["a"],
      height: 10,
      id: "group",
      locked: false,
      rotation: 0,
      visible: true,
      width: 10,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    canvas.addElement([makeRect("a", 0), makeRect("b", 1), group])

    canvas.bringToFront("group")

    expect(canvas.getElements().get("a")!.zIndex).toBeGreaterThan(1)
    expect(canvas.getElements().get("group")!.zIndex).toBeGreaterThan(1)
    expect(canvas.getElements().get("b")!.zIndex).toBe(1)
  })

  it("ignores unknown ids", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRect("a", 0))

    canvas.bringToFront(["missing"])

    expect(canvas.getElements().get("a")!.zIndex).toBe(0)
  })

  it("is undoable and skippable", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 0), makeRect("b", 1)])

    canvas.bringToFront("a")
    expect(canvas.undo()).toBe(true)
    expect(zIndexes(canvas)).toEqual({ a: 0, b: 1 })

    canvas.bringToFront("a", { history: false })
    expect(zIndexes(canvas)).toEqual({ a: 2, b: 1 })
  })

  it("does not publish change when already at the front", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 0), makeRect("b", 1)])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.bringToFront("b")

    expect(listener).not.toHaveBeenCalled()
    store.dispose()
  })
})

describe("sendToBack", () => {
  it("moves elements below everything, preserving their relative order", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 0), makeRect("b", 1), makeRect("c", 2)])

    canvas.sendToBack(["b", "c"])

    expect(zIndexes(canvas)).toEqual({ a: 0, b: -2, c: -1 })
  })

  it("normalizes to 0..n-1 when nothing else is on the canvas", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 5), makeRect("b", 9)])

    canvas.sendToBack(["a", "b"])

    expect(zIndexes(canvas)).toEqual({ a: 0, b: 1 })
  })

  it("is undoable and skippable", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("a", 0), makeRect("b", 1)])

    canvas.sendToBack("b")
    expect(canvas.undo()).toBe(true)
    expect(zIndexes(canvas)).toEqual({ a: 0, b: 1 })

    canvas.sendToBack("b", { history: false })
    expect(zIndexes(canvas)).toEqual({ a: 0, b: -1 })
  })
})

describe("setZIndex", () => {
  it("sets an exact z-index", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRect("a", 3))

    canvas.setZIndex("a", 10)

    expect(canvas.getElements().get("a")!.zIndex).toBe(10)
  })

  it("is a no-op for a missing id or an unchanged value", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRect("a", 3))
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.setZIndex("missing", 10)
    canvas.setZIndex("a", 3)

    expect(listener).not.toHaveBeenCalled()
    store.dispose()
  })

  it("rejects non-finite values", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRect("a", 3))

    expect(() => canvas.setZIndex("a", Number.NaN)).toThrow(RangeError)
  })
})

describe("insertMedia z-index", () => {
  it("uses an explicit base z-index for the batch", () => {
    const canvas = new AdrawCanvas()

    const result = canvas.insertMedia(
      [
        mediaDescriptor("data:image/png,1"),
        mediaDescriptor("data:image/png,2"),
      ],
      { zIndex: 0 },
    )

    expect(result.map((element) => element.zIndex)).toEqual([0, 1])
  })

  it("rejects non-finite values", () => {
    const canvas = new AdrawCanvas()

    expect(() =>
      canvas.insertMedia(mediaDescriptor(), {
        zIndex: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(RangeError)
  })

  it("keeps a base image below existing annotations", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement([makeRect("note-1", 0), makeRect("note-2", 1)])

    const [image] = canvas.insertMedia(mediaDescriptor(), { zIndex: 0 })
    canvas.sendToBack(image.id)

    expect(canvas.getElements().get(image.id)!.zIndex).toBeLessThan(0)
    expect(canvas.getElements().get("note-1")!.zIndex).toBe(0)
    expect(canvas.getElements().get("note-2")!.zIndex).toBe(1)
  })
})
