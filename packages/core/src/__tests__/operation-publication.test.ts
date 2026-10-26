// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"
import { AdrawStore, type AdrawSnapshot } from "../store"

function makeRect(id: string) {
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

function pointerEvent(): PointerEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: {
      getAttribute: () => null,
    },
  } as unknown as PointerEvent
}

function expectCoherent(snapshot: AdrawSnapshot): void {
  for (const id of snapshot.selectedIds) {
    expect(snapshot.elements.has(id)).toBe(true)
  }
  expect(snapshot.selectedElements.map((element) => element.id)).toEqual([
    ...snapshot.selectedIds,
  ])
}

function track(store: AdrawStore): AdrawSnapshot[] {
  const snapshots: AdrawSnapshot[] = []
  store.subscribe(() => {
    const snapshot = store.getSnapshot()
    expectCoherent(snapshot)
    snapshots.push(snapshot)
  })
  return snapshots
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

describe("operation-scoped publication", () => {
  it("publishes deleteSelected as one coherent snapshot", () => {
    const canvas = new AdrawCanvas({
      initialElements: [makeRect("a"), makeRect("b")],
    })
    const store = new AdrawStore(canvas)
    canvas.selectAll()
    const revision = store.getSnapshot().revision
    const snapshots = track(store)

    canvas.deleteSelected()

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].revision).toBe(revision + 1)
    expect(snapshots[0].elements.size).toBe(0)
    expect(snapshots[0].selectedIds.size).toBe(0)
    expect(snapshots[0].selectedElements).toEqual([])
    expect(snapshots[0].canUndo).toBe(true)
    store.dispose()
  })

  it("publishes a selected style change as one snapshot", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)
    canvas.selectAll()
    const snapshots = track(store)

    canvas.setStyle({ fillColor: "#ff0000" })

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].style.fillColor).toBe("#ff0000")
    expect(snapshots[0].selectedElements[0]?.fillColor).toBe("#ff0000")
    store.dispose()
  })

  it("publishes paste and its tool switch as one snapshot", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)
    canvas.selectAll()
    canvas.copy()
    canvas.setActiveTool("line")
    const snapshots = track(store)

    canvas.paste()

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].elements.size).toBe(2)
    expect(snapshots[0].selectedIds.size).toBe(1)
    expect(snapshots[0].tool).toBe("select")
    store.dispose()
  })

  it("publishes one programmatic pointer-up operation once", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    canvas.setActiveTool("rectangle")
    const snapshots = track(store)

    canvas.handlePointerDown(0, 0, pointerEvent())
    canvas.handlePointerMove(100, 100, pointerEvent())
    canvas.handlePointerUp(100, 100, pointerEvent())

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].elements.size).toBe(1)
    expect(snapshots[0].selectedIds.size).toBe(1)
    expect(snapshots[0].canUndo).toBe(true)
    expect(snapshots[0].tool).toBe("select")
    store.dispose()
  })

  it("publishes one native pointer-up operation once", () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const canvas = new AdrawCanvas({ container })
    canvas.setCanvasSize(800, 600)
    canvas.setActiveTool("rectangle")
    const store = new AdrawStore(canvas)
    const snapshots = track(store)
    const svg = container.querySelector("svg")!
    const dispatch = (type: string, x: number, y: number): void => {
      svg.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          pointerId: 1,
        }),
      )
    }

    dispatch("pointerdown", 410, 310)
    dispatch("pointermove", 510, 410)
    dispatch("pointerup", 510, 410)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].elements.size).toBe(1)
    expect(snapshots[0].selectedIds.size).toBe(1)
    expect(snapshots[0].tool).toBe("select")
    store.dispose()
    canvas.destroy()
  })

  it("suppresses a snapshot when a no-op operation is marked dirty", () => {
    const canvas = new AdrawCanvas({ initialElements: [makeRect("a")] })
    const store = new AdrawStore(canvas)
    const listener = vi.fn()
    store.subscribe(listener)
    const revision = store.getSnapshot().revision

    canvas.setElements(new Map(canvas.getElements()), { history: false })

    expect(listener).not.toHaveBeenCalled()
    expect(store.getSnapshot().revision).toBe(revision)
    store.dispose()
  })

  it("flushes actual state after a failed operation", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const snapshots = track(store)

    expect(() =>
      canvas.withoutHistory(() => {
        canvas.addElement(makeRect("a"))
        throw new Error("operation failed")
      }),
    ).toThrow("operation failed")

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].elements.has("a")).toBe(true)
    store.dispose()
  })

  it("preserves the operation error over a listener error", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const operationError = new Error("operation failed")
    const listenerError = new Error("listener failed")
    const listener = vi.fn(() => {
      throw listenerError
    })
    store.subscribe(listener)

    expect(() =>
      canvas.withoutHistory(() => {
        canvas.addElement(makeRect("a"))
        throw operationError
      }),
    ).toThrow(operationError)
    expect(listener).toHaveBeenCalledOnce()
    store.dispose()
  })

  it("notifies later listeners after a listener throws", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const listenerError = new Error("listener failed")
    const heard: string[] = []
    store.subscribe(() => {
      heard.push("first")
      throw listenerError
    })
    store.subscribe(() => {
      heard.push("second")
    })

    expect(() => canvas.addElement(makeRect("a"))).toThrow(listenerError)
    expect(heard).toEqual(["first", "second"])
    expect(store.getSnapshot().elements.has("a")).toBe(true)
    store.dispose()
  })

  it("delivers to the listener set captured at publication start", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const heard: string[] = []
    let unsubscribeSecond = () => {}
    store.subscribe(() => {
      heard.push("first")
      unsubscribeSecond()
    })
    unsubscribeSecond = store.subscribe(() => {
      heard.push("second")
    })

    canvas.addElement(makeRect("a"))

    expect(heard).toEqual(["first", "second"])
    store.dispose()
  })

  it("lets a listener start a new coherent operation reentrantly", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const snapshots: AdrawSnapshot[] = []
    let nested = false

    store.subscribe(() => {
      snapshots.push(store.getSnapshot())
      if (!nested) {
        nested = true
        canvas.addElement(makeRect("b"))
      }
    })
    canvas.addElement(makeRect("a"))

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].elements.has("a")).toBe(true)
    expect(snapshots[0].elements.has("b")).toBe(false)
    expect(snapshots[1].elements.has("a")).toBe(true)
    expect(snapshots[1].elements.has("b")).toBe(true)
    expect(snapshots[1].revision).toBe(snapshots[0].revision + 1)
    store.dispose()
  })

  it("publishes async withoutHistory work at synchronous boundaries", async () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const snapshots = track(store)
    let release = () => {}

    const pending = canvas.withoutHistory(async () => {
      canvas.addElement(makeRect("a"))
      await new Promise<void>((resolve) => {
        release = resolve
      })
      canvas.addElement(makeRect("b"))
    })

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].elements.has("a")).toBe(true)
    expect(snapshots[0].elements.has("b")).toBe(false)

    release()
    await pending

    expect(snapshots).toHaveLength(2)
    expect(snapshots[1].elements.has("a")).toBe(true)
    expect(snapshots[1].elements.has("b")).toBe(true)
    store.dispose()
  })
})
