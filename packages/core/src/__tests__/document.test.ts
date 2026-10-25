import { describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createArrow, createRectangle } from "../elements"
import { AdrawStore } from "../store"
import type { ArrowElement, CanvasElement, RectangleElement } from "../types"

function makeRectangle(
  id: string,
  x = 0,
  y = 0,
  width = 10,
  height = 10,
  zIndex = 1,
): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    visible: true,
    width,
    x,
    y,
    zIndex,
  })
}

describe("addElement", () => {
  it("adds a single element", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRectangle("rect-1")

    const result = canvas.addElement(rect)

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(rect)
    expect(canvas.getElements().get("rect-1")).toBe(rect)
    expect(canvas.getElements().size).toBe(1)
  })

  it("accepts an array of elements", () => {
    const canvas = new AdrawCanvas()
    const a = makeRectangle("a")
    const b = makeRectangle("b", 20, 20)

    const result = canvas.addElement([a, b])

    expect(result).toHaveLength(2)
    expect(canvas.getElements().size).toBe(2)
    expect(canvas.getElements().has("a")).toBe(true)
    expect(canvas.getElements().has("b")).toBe(true)
  })

  it("publishes the new element to the store", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.addElement(makeRectangle("rect-1"))

    expect(listener).toHaveBeenCalled()
    expect(store.getSnapshot().elements.size).toBe(1)
    store.dispose()
  })

  it("pushes history by default so the addition is undoable", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRectangle("rect-1")

    canvas.addElement(rect)

    expect(canvas.canUndo()).toBe(true)
    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().size).toBe(0)
  })

  it("skips history when { history: false }", () => {
    const canvas = new AdrawCanvas()

    canvas.addElement(makeRectangle("rect-1"), { history: false })

    expect(canvas.canUndo()).toBe(false)
    expect(canvas.getElements().size).toBe(1)
  })

  it("does not wipe out a previously undoable edit when skipping history", () => {
    const canvas = new AdrawCanvas()

    canvas.addElement(makeRectangle("rect-1"))
    expect(canvas.canUndo()).toBe(true)

    canvas.addElement(makeRectangle("rect-2"), { history: false })
    expect(canvas.getElements().size).toBe(2)
  })

  it("keeps skipped elements across a later undo", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("recorded"))
    canvas.addElement(makeRectangle("skipped", 20), { history: false })

    canvas.undo()

    expect(canvas.getElements().has("recorded")).toBe(false)
    expect(canvas.getElements().has("skipped")).toBe(true)
  })

  it("preserves selection state", () => {
    const canvas = new AdrawCanvas()

    canvas.addElement(makeRectangle("rect-1"))

    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("keeps bound arrows in sync", () => {
    const canvas = new AdrawCanvas()
    const target = makeRectangle("target", 0, 0, 20, 20)
    const arrow = createArrow({
      endArrowhead: true,
      endBinding: { elementId: "target" },
      endX: 50,
      endY: 10,
      height: 1,
      id: "arrow-1",
      locked: false,
      rotation: 0,
      startArrowhead: false,
      startBinding: null,
      startX: 0,
      startY: 0,
      strokeColor: "#000",
      strokeWidth: 1,
      visible: true,
      width: 50,
      x: 0,
      y: 0,
      zIndex: 2,
    }) as ArrowElement

    canvas.addElement([target, arrow])

    const resolved = canvas.getElements().get("arrow-1") as ArrowElement
    expect(resolved.startBinding).toBeNull()
    expect(resolved.endBinding?.elementId).toBe("target")
  })
})

describe("loadDocument", () => {
  it("replaces the element set with the document's elements", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    canvas.loadDocument({
      elements: [makeRectangle("new-1"), makeRectangle("new-2", 30, 30)],
      version: 1,
    })

    expect(canvas.getElements().size).toBe(2)
    expect(canvas.getElements().has("old")).toBe(false)
    expect(canvas.getElements().has("new-1")).toBe(true)
    expect(canvas.getElements().has("new-2")).toBe(true)
  })

  it("clears the selection", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRectangle("rect-1")
    canvas.addElement(rect)
    canvas.setSelectedIds(new Set([rect.id]))

    canvas.loadDocument({ elements: [], version: 1 })

    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("publishes elements and the cleared selection", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.loadDocument({ elements: [makeRectangle("rect-1")], version: 1 })

    expect(listener).toHaveBeenCalled()
    expect(store.getSnapshot().elements.size).toBe(1)
    expect(store.getSnapshot().selectedIds.size).toBe(0)
    store.dispose()
  })

  it("pushes history by default", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    // Two stacked edits before load; load pushes a third checkpoint.
    canvas.loadDocument({ elements: [], version: 1 })

    expect(canvas.canUndo()).toBe(true)
    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has("old")).toBe(true)
  })

  it("skips history when { history: false }", () => {
    const canvas = new AdrawCanvas()

    canvas.loadDocument(
      { elements: [makeRectangle("rect-1")], version: 1 },
      {
        history: false,
      },
    )

    expect(canvas.canUndo()).toBe(false)
  })

  it("does not reintroduce the previous document on undo when history is skipped", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    canvas.loadDocument(
      { elements: [makeRectangle("new")], version: 1 },
      { history: false },
    )
    canvas.undo()

    expect(canvas.getElements().has("new")).toBe(true)
    expect(canvas.getElements().has("old")).toBe(false)
  })

  it("tolerates a missing or empty elements array", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    canvas.loadDocument({ elements: [], version: 1 })
    expect(canvas.getElements().size).toBe(0)

    canvas.loadDocument({ version: 1 } as {
      version: number
      elements: CanvasElement[]
    })
    expect(canvas.getElements().size).toBe(0)
  })

  it("resolves arrow bindings against the loaded targets", () => {
    const canvas = new AdrawCanvas()
    const target = makeRectangle("target", 0, 0, 20, 20)
    const arrow = createArrow({
      endArrowhead: true,
      endBinding: { elementId: "target" },
      endX: 50,
      endY: 10,
      height: 1,
      id: "arrow-1",
      locked: false,
      rotation: 0,
      startArrowhead: false,
      startBinding: null,
      startX: 0,
      startY: 0,
      strokeColor: "#000",
      strokeWidth: 1,
      visible: true,
      width: 50,
      x: 0,
      y: 0,
      zIndex: 2,
    }) as ArrowElement

    canvas.loadDocument({ elements: [target, arrow], version: 1 })

    const resolved = canvas.getElements().get("arrow-1") as ArrowElement
    expect(resolved.endBinding?.elementId).toBe("target")
  })
})

describe("toDocument", () => {
  it("returns version and elements", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("rect-1"))
    canvas.addElement(makeRectangle("rect-2", 20, 20))

    const doc = canvas.toDocument()

    expect(doc.version).toBe(1)
    expect(doc.elements).toHaveLength(2)
    expect(doc.elements.map((el) => el.id).toSorted()).toEqual([
      "rect-1",
      "rect-2",
    ])
  })

  it("excludes elements matching the predicate", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("rect-1"))

    const textLike = makeRectangle("rect-2", 10, 10)
    canvas.addElement(textLike)

    const doc = canvas.toDocument({ exclude: (el) => el.id === "rect-2" })

    expect(doc.elements).toHaveLength(1)
    expect(doc.elements[0].id).toBe("rect-1")
  })

  it("does not mutate canvas state", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("rect-1"))

    const doc = canvas.toDocument()
    doc.elements.pop()

    expect(canvas.getElements().size).toBe(1)
  })

  it("returns decoupled copies", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRectangle("rect-1")
    canvas.addElement(rect)

    const doc = canvas.toDocument()
    doc.elements[0].x = 999

    expect(canvas.getElements().get("rect-1")?.x).toBe(0)
  })

  it("round-trips through loadDocument", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("rect-1"))
    canvas.addElement(makeRectangle("rect-2", 5, 5))

    const doc = canvas.toDocument()

    const restored = new AdrawCanvas()
    restored.loadDocument(doc, { history: false })

    expect(restored.getElements().size).toBe(2)
    expect([...restored.getElements().keys()].toSorted()).toEqual([
      "rect-1",
      "rect-2",
    ])
  })
})

describe("toJSON", () => {
  it("is an alias of toDocument", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("rect-1"))

    const doc = canvas.toDocument()
    const json = canvas.toJSON()

    expect(json).toEqual(doc)
  })
})

describe("setElements", () => {
  it("replaces the element set from a Map", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    canvas.setElements(new Map([["new-1", makeRectangle("new-1")]]))

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has("new-1")).toBe(true)
    expect(canvas.getElements().has("old")).toBe(false)
  })

  it("accepts an array of elements", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    canvas.setElements([makeRectangle("a"), makeRectangle("b", 20, 20)])

    expect(canvas.getElements().size).toBe(2)
  })

  it("intersects selection with the new ids", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRectangle("rect-1")
    canvas.addElement(rect)
    canvas.setSelectedIds(new Set([rect.id, "missing"]))

    canvas.setElements([makeRectangle("other")])

    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("skips history when { history: false }", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeRectangle("old"))

    canvas.setElements([], { history: false })

    expect(canvas.getElements().size).toBe(0)
    // The original addElement still leaves history available.
    expect(canvas.canUndo()).toBe(true)
  })
})

describe("initial document", () => {
  it("loads initialElements into the history baseline", () => {
    const canvas = new AdrawCanvas({
      initialElements: [makeRectangle("a"), makeRectangle("b", 20, 20)],
    })

    expect(canvas.getElements().size).toBe(2)
    expect(canvas.getSelectedIds().size).toBe(0)
    expect(canvas.canUndo()).toBe(false)

    canvas.addElement(makeRectangle("c", 40, 40))
    expect(canvas.undo()).toBe(true)
    expect([...canvas.getElements().keys()]).toEqual(["a", "b"])
  })

  it("prefers initialDocument over initialElements", () => {
    const canvas = new AdrawCanvas({
      initialDocument: {
        elements: [makeRectangle("document")],
        version: 1,
      },
      initialElements: [makeRectangle("elements")],
    })

    expect([...canvas.getElements().keys()]).toEqual(["document"])
  })

  it("clones initial elements so callers cannot mutate engine state", () => {
    const document = {
      elements: [makeRectangle("rect-1")],
      version: 1,
    }
    const canvas = new AdrawCanvas({ initialDocument: document })

    document.elements[0].x = 999

    expect(canvas.getElements().get("rect-1")?.x).toBe(0)
  })

  it("resolves arrow bindings against initial elements", () => {
    const target = makeRectangle("target", 0, 0, 20, 20)
    const arrow = createArrow({
      endArrowhead: true,
      endBinding: { elementId: "target" },
      endX: 50,
      endY: 10,
      height: 1,
      id: "arrow-1",
      locked: false,
      rotation: 0,
      startArrowhead: false,
      startBinding: null,
      startX: 0,
      startY: 0,
      strokeColor: "#000",
      strokeWidth: 1,
      visible: true,
      width: 50,
      x: 0,
      y: 0,
      zIndex: 2,
    }) as ArrowElement

    const canvas = new AdrawCanvas({ initialElements: [target, arrow] })

    const resolved = canvas.getElements().get("arrow-1") as ArrowElement
    expect(resolved.endBinding?.elementId).toBe("target")
  })
})
