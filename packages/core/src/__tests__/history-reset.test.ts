import { describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"
import { AdrawStore } from "../store"
import type { RectangleElement } from "../types"

function makeRectangle(id: string, x = 0, y = 0): RectangleElement {
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
    x,
    y,
    zIndex: 1,
  })
}

describe("clearHistory", () => {
  it("discards undo and redo entries but keeps the current state", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("a"))
    canvas.undo()
    expect(canvas.canRedo()).toBe(true)

    canvas.clearHistory()

    expect(canvas.canUndo()).toBe(false)
    expect(canvas.canRedo()).toBe(false)
    expect(canvas.undo()).toBe(false)
    expect(canvas.redo()).toBe(false)
    expect(canvas.getElements().size).toBe(0)
  })

  it("uses the current elements as the baseline for later undo", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("base"))
    canvas.addElement(makeRectangle("also-base", 20))

    canvas.clearHistory()
    canvas.addElement(makeRectangle("later", 40))

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("later")).toBe(false)
    expect(canvas.getElements().has("base")).toBe(true)
    expect(canvas.getElements().has("also-base")).toBe(true)
  })

  it("notifies the store so history availability refreshes", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("a"))
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.clearHistory()

    expect(listener).toHaveBeenCalled()
    expect(store.getSnapshot().canUndo).toBe(false)
    store.dispose()
  })
})

describe("withoutHistory", () => {
  it("does not push checkpoints and returns the callback result", () => {
    const canvas = new AdrawCanvas()

    const result = canvas.withoutHistory(() => {
      canvas.addElement(makeRectangle("base"))
      return "done"
    })

    expect(result).toBe("done")
    expect(canvas.getElements().has("base")).toBe(true)
    expect(canvas.canUndo()).toBe(false)
  })

  it("keeps changes made inside across a later undo", () => {
    const canvas = new AdrawCanvas()

    canvas.withoutHistory(() => {
      canvas.addElement(makeRectangle("base"))
    })
    canvas.addElement(makeRectangle("user", 20))

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("base")).toBe(true)
    expect(canvas.getElements().has("user")).toBe(false)
  })

  it("preserves checkpoints recorded before the callback", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("earlier"))

    canvas.withoutHistory(() => {
      canvas.addElement(makeRectangle("base", 20))
    })

    expect(canvas.canUndo()).toBe(true)
    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("earlier")).toBe(false)
    expect(canvas.getElements().has("base")).toBe(true)
  })

  it("coalesces nested calls", () => {
    const canvas = new AdrawCanvas()

    canvas.withoutHistory(() => {
      canvas.withoutHistory(() => {
        canvas.addElement(makeRectangle("base"))
      })
      canvas.addElement(makeRectangle("nested", 20))
    })
    canvas.addElement(makeRectangle("user", 40))

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("base")).toBe(true)
    expect(canvas.getElements().has("nested")).toBe(true)
    expect(canvas.getElements().has("user")).toBe(false)
  })

  it("restores history recording after an exception", () => {
    const canvas = new AdrawCanvas()

    expect(() =>
      canvas.withoutHistory(() => {
        throw new Error("boom")
      }),
    ).toThrow("boom")

    canvas.addElement(makeRectangle("a"))
    expect(canvas.canUndo()).toBe(true)
  })

  it("suppresses history until an async callback settles", async () => {
    const canvas = new AdrawCanvas()

    await canvas.withoutHistory(async () => {
      await Promise.resolve()
      canvas.addElement(makeRectangle("base"))
    })

    expect(canvas.canUndo()).toBe(false)
    expect(canvas.getElements().has("base")).toBe(true)
  })

  it("keeps modifications across undo without making earlier additions permanent", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("a"))

    canvas.withoutHistory(() => {
      canvas.addElement(makeRectangle("a", 50), { history: false })
    })
    canvas.addElement(makeRectangle("later", 100))

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().get("a")?.x).toBe(50)
    expect(canvas.getElements().has("later")).toBe(false)

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("a")).toBe(false)
  })

  it("keeps removed outside-history elements removed across undo", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("a"))
    canvas.addElement(makeRectangle("b", 20))

    canvas.withoutHistory(() => {
      canvas.setSelectedIds(new Set(["a"]))
      canvas.deleteSelected()
    })
    canvas.addElement(makeRectangle("later", 40))

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("later")).toBe(false)
    expect(canvas.getElements().has("a")).toBe(false)
    expect(canvas.getElements().has("b")).toBe(true)
  })
})

describe("pushHistory", () => {
  it("records the current state as the next checkpoint", () => {
    const canvas = new AdrawCanvas()
    canvas.getElements().set("manual", makeRectangle("manual"))

    canvas.pushHistory()
    canvas.undo()

    expect(canvas.getElements().has("manual")).toBe(false)
  })

  it("is a no-op inside withoutHistory", () => {
    const canvas = new AdrawCanvas()

    canvas.withoutHistory(() => {
      canvas.addElement(makeRectangle("base"))
      canvas.pushHistory()
    })

    expect(canvas.canUndo()).toBe(false)
  })
})
