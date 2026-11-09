import { describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"
import { AdrawStore } from "../store"
import type { CanvasElement, RectangleElement } from "../types"

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

function setup(elements: CanvasElement[]): AdrawCanvas {
  const canvas = new AdrawCanvas()
  canvas.addElement(elements, { history: false })
  canvas.clearHistory()
  return canvas
}

describe("batch", () => {
  it("records one undo step for multiple mutations and publishes once", () => {
    const canvas = setup([rectangle("a")])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    const result = canvas.batch(() => {
      canvas.addElement(rectangle("b"))
      canvas.addElement(rectangle("c", { x: 40 }))
      return "done"
    })

    expect(result).toBe("done")
    expect(canvas.getElements().size).toBe(3)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has("a")).toBe(true)
    store.dispose()
  })

  it("coalesces nested batches into the outer checkpoint", () => {
    const canvas = setup([rectangle("a")])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.batch(() => {
      canvas.addElement(rectangle("b"))
      canvas.batch(() => {
        canvas.addElement(rectangle("c", { x: 40 }))
      })
      canvas.addElement(rectangle("d", { x: 80 }))
    })

    expect(canvas.getElements().size).toBe(4)
    expect(listener).toHaveBeenCalledTimes(1)

    canvas.undo()

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has("a")).toBe(true)
    store.dispose()
  })

  it("suppresses explicit checkpoints inside the batch", () => {
    const canvas = setup([rectangle("a")])

    canvas.batch(() => {
      canvas.addElement(rectangle("b"))
      canvas.pushHistory()
      canvas.addElement(rectangle("c", { x: 40 }))
    })

    canvas.undo()

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has("a")).toBe(true)
  })

  it("supports { history: false } and preserves the change across undo", () => {
    const canvas = setup([rectangle("a")])

    canvas.batch(
      () => {
        canvas.addElement(rectangle("b"))
      },
      { history: false },
    )

    expect(canvas.canUndo()).toBe(false)

    canvas.addElement(rectangle("c", { x: 40 }))
    canvas.undo()

    expect(canvas.getElements().has("b")).toBe(true)
    expect(canvas.getElements().has("c")).toBe(false)
  })

  it("keeps the outermost batch's history mode for nested batches", () => {
    const canvas = setup([rectangle("a")])

    canvas.batch(() => {
      canvas.addElement(rectangle("b"))
      canvas.batch(
        () => {
          canvas.addElement(rectangle("c", { x: 40 }))
        },
        { history: false },
      )
    })

    canvas.undo()

    expect(canvas.getElements().has("b")).toBe(false)
    expect(canvas.getElements().has("c")).toBe(false)
    expect(canvas.getElements().has("a")).toBe(true)
  })

  it("keeps partial changes undoable when the callback throws", () => {
    const canvas = setup([rectangle("a")])
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() =>
      canvas.batch(() => {
        canvas.addElement(rectangle("b"))
        throw new Error("boom")
      }),
    ).toThrow("boom")

    expect(canvas.getElements().has("b")).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()

    expect(canvas.getElements().has("b")).toBe(false)
    expect(canvas.getElements().has("a")).toBe(true)
    store.dispose()
  })

  it("rejects async callbacks and keeps synchronous work undoable", () => {
    const canvas = setup([rectangle("a")])

    expect(() =>
      canvas.batch(async () => {
        canvas.addElement(rectangle("b"))
      }),
    ).toThrow(/synchronous/)

    expect(canvas.getElements().has("b")).toBe(true)
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()
    expect(canvas.getElements().has("b")).toBe(false)
  })

  it("does not publish or record history when nothing changes", () => {
    const canvas = setup([rectangle("a")])
    const store = new AdrawStore(canvas)
    const revision = store.getSnapshot().revision

    const result = canvas.batch(() => 42)

    expect(result).toBe(42)
    expect(store.getSnapshot().revision).toBe(revision)
    expect(canvas.canUndo()).toBe(false)
    store.dispose()
  })

  it("treats selection-only changes as one checkpoint", () => {
    const canvas = setup([rectangle("a"), rectangle("b", { x: 40 })])

    canvas.batch(() => {
      canvas.setSelectedIds(new Set(["a"]))
      canvas.setSelectedIds(new Set(["b"]))
    })

    expect([...canvas.getSelectedIds()]).toEqual(["b"])
    expect(canvas.canUndo()).toBe(true)

    canvas.undo()

    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("does not record a checkpoint when called inside withoutHistory", () => {
    const canvas = setup([rectangle("a")])

    canvas.withoutHistory(() => {
      canvas.batch(() => {
        canvas.addElement(rectangle("b"))
      })
    })

    expect(canvas.canUndo()).toBe(false)
    expect(canvas.getElements().has("b")).toBe(true)
  })
})
