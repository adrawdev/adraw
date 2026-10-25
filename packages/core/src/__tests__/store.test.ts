// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"
import { AdrawStore } from "../store"

function makeRect(id: string): ReturnType<typeof createRectangle> {
  return createRectangle({
    cornerRadius: 0,
    height: 10,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#111",
    strokeWidth: 2,
    visible: true,
    width: 10,
    x: 0,
    y: 0,
    zIndex: 0,
  })
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect(): void {}
      observe(): void {}
    },
  )
})

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe("AdrawStore snapshots", () => {
  it("starts at revision zero with the engine state", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)
    const snapshot = store.getSnapshot()

    expect(snapshot.revision).toBe(0)
    expect(snapshot.elements.size).toBe(1)
    expect(snapshot.selectedIds.size).toBe(0)
    expect(snapshot.selectedElements).toHaveLength(0)
    expect(snapshot.tool).toBe("select")
    expect(snapshot.canUndo).toBe(false)
    expect(snapshot.canRedo).toBe(false)
    expect(snapshot.isReady).toBe(false)
    expect(snapshot.snapping.threshold).toBe(5)
    expect(store.getSnapshot()).toBe(snapshot)

    store.dispose()
  })

  it("publishes element changes and history availability", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.addElement(makeRect("a"))

    const snapshot = store.getSnapshot()
    expect(listener).toHaveBeenCalled()
    expect(snapshot.elements.has("a")).toBe(true)
    expect(snapshot.canUndo).toBe(true)
    expect(snapshot.revision).toBeGreaterThan(0)
    store.dispose()
  })

  it("reuses unchanged slices on viewport changes", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)
    const before = store.getSnapshot()

    canvas.setViewport({ x: 10, y: 20, zoom: 2 })
    const after = store.getSnapshot()

    expect(after.elements).toBe(before.elements)
    expect(after.selectedIds).toBe(before.selectedIds)
    expect(after.selectedElements).toBe(before.selectedElements)
    expect(after.viewport).toEqual({ x: 10, y: 20, zoom: 2 })
    store.dispose()
  })

  it("copies elements when they change", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)
    const before = store.getSnapshot()

    canvas.addElement(makeRect("b"))
    const after = store.getSnapshot()

    expect(after.elements).not.toBe(before.elements)
    expect(after.elements.size).toBe(2)
    store.dispose()
  })

  it("publishes selection and derives selectedElements", () => {
    const canvas = new AdrawCanvas({
      initialElements: [makeRect("a"), makeRect("b")],
    })
    const store = new AdrawStore(canvas)

    canvas.selectAll()

    const snapshot = store.getSnapshot()
    expect([...snapshot.selectedIds]).toEqual(["a", "b"])
    expect(snapshot.selectedElements.map((element) => element.id)).toEqual([
      "a",
      "b",
    ])
    store.dispose()
  })

  it("publishes style, snapping and tool options", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    canvas.setStyle({ strokeColor: "#f00" })
    canvas.setSnappingConfig({ threshold: 12 })
    canvas.setIsSnapMode(true)
    canvas.setIsToolLocked(true)
    canvas.setHideOverlayWhileTransforming(true)

    const snapshot = store.getSnapshot()
    expect(snapshot.style.strokeColor).toBe("#f00")
    expect(snapshot.snapping.threshold).toBe(12)
    expect(snapshot.isSnapMode).toBe(true)
    expect(snapshot.isToolLocked).toBe(true)
    expect(snapshot.hideWhileTransforming).toBe(true)
    expect(listener).toHaveBeenCalled()
    store.dispose()
  })

  it("publishes tool and history changes", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)

    canvas.setActiveTool("rectangle")
    expect(store.getSnapshot().tool).toBe("rectangle")
    expect(store.getSnapshot().canUndo).toBe(false)

    canvas.pushHistory()
    expect(store.getSnapshot().canUndo).toBe(true)
    store.dispose()
  })

  it("publishes a checkpoint pushed through the tool context", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    canvas.addElement(makeRect("b"), { history: false })
    const store = new AdrawStore(canvas)

    expect(store.getSnapshot().canUndo).toBe(false)
    canvas.getToolContext().pushHistory()

    expect(store.getSnapshot().canUndo).toBe(true)
    store.dispose()
  })

  it("publishes undo and redo", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    canvas.addElement(makeRect("a"))

    canvas.undo()
    expect(store.getSnapshot().elements.size).toBe(0)
    expect(store.getSnapshot().canRedo).toBe(true)

    canvas.redo()
    expect(store.getSnapshot().elements.has("a")).toBe(true)
    store.dispose()
  })

  it("suppresses no-op viewport and selection changes", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)
    const revision = store.getSnapshot().revision

    canvas.setViewport(canvas.getViewport())
    canvas.clearSelection()

    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().revision).toBe(revision)
    store.dispose()
  })

  it("stops publishing after dispose", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)

    store.dispose()
    canvas.addElement(makeRect("a"))

    expect(listener).not.toHaveBeenCalled()
  })
})

describe("AdrawStore readiness", () => {
  it("fires onReady once per engine across remounts", () => {
    const canvas = new AdrawCanvas()
    const onReady = vi.fn()
    const store = new AdrawStore(canvas, { onReady })
    const container = document.createElement("div")
    document.body.appendChild(container)

    expect(store.getSnapshot().isReady).toBe(false)

    canvas.mount(container)
    expect(store.getSnapshot().isReady).toBe(true)
    expect(onReady).toHaveBeenCalledOnce()
    expect(onReady).toHaveBeenCalledWith(canvas)

    canvas.destroy()
    expect(store.getSnapshot().isReady).toBe(false)

    canvas.mount(container)
    expect(store.getSnapshot().isReady).toBe(true)
    expect(onReady).toHaveBeenCalledOnce()

    store.dispose()
    canvas.destroy()
  })

  it("fires onReady immediately when created after mount", () => {
    const canvas = new AdrawCanvas()
    const container = document.createElement("div")
    document.body.appendChild(container)
    canvas.mount(container)

    const onReady = vi.fn()
    const store = new AdrawStore(canvas, { onReady })

    expect(store.getSnapshot().isReady).toBe(true)
    expect(onReady).toHaveBeenCalledOnce()

    store.dispose()
    canvas.destroy()
  })
})
