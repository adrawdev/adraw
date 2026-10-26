import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createArrow, createRectangle } from "../elements"
import { Scene } from "../engine/scene"
import { approximateTextMeasurer } from "../text"
import type {
  ArrowElement,
  CanvasElement,
  ElementId,
  RectangleElement,
} from "../types"

function makeRect(id: string, x = 0, y = 0): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 50,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x,
    y,
    zIndex: 0,
  })
}

function makeArrow(id: string, targetId: string): ArrowElement {
  return createArrow({
    endArrowhead: true,
    endBinding: { elementId: targetId },
    endX: 200,
    endY: 25,
    height: 50,
    id,
    locked: false,
    rotation: 0,
    startBinding: null,
    startX: 0,
    startY: 25,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 200,
    x: 0,
    y: 0,
    zIndex: 1,
  })
}

function makeScene(elements: CanvasElement[] = []): Scene {
  const scene = new Scene({
    getTextMeasurer: () => approximateTextMeasurer,
  })
  if (elements.length > 0) {
    scene.replace(
      new Map<ElementId, CanvasElement>(
        elements.map((element) => [element.id, element]),
      ),
      { selection: "clear" },
    )
  }
  scene.clearHistory()
  return scene
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Scene commits", () => {
  it("starts with an empty baseline and no undo", () => {
    const scene = makeScene()
    expect(scene.getElements().size).toBe(0)
    expect(scene.getSelectedIds().size).toBe(0)
    expect(scene.canUndo()).toBe(false)
    expect(scene.canRedo()).toBe(false)
  })

  it("reports element changes without recording history by default", () => {
    const scene = makeScene()
    const rect = makeRect("a")
    const change = scene.commit((draft) => {
      draft.elements.set(rect.id, rect)
    })

    expect(change.elementsChanged).toBe(true)
    expect(change.selectionChanged).toBe(false)
    expect(change.historyChanged).toBe(false)
    expect(scene.getElements().get("a")).toBe(rect)
    expect(scene.canUndo()).toBe(false)
  })

  it("checkpoints only when asked and supports undo/redo", () => {
    const scene = makeScene()
    const rect = makeRect("a")
    const change = scene.commit(
      (draft) => {
        draft.elements.set(rect.id, rect)
      },
      { history: true },
    )

    expect(change.historyChanged).toBe(true)
    expect(scene.canUndo()).toBe(true)
    expect(scene.undo().elementsChanged).toBe(true)
    expect(scene.getElements().has("a")).toBe(false)
    expect(scene.canRedo()).toBe(true)
    expect(scene.redo().elementsChanged).toBe(true)
    expect(scene.getElements().get("a")).toBe(rect)
  })

  it("discards a throwing mutator and stays usable", () => {
    const scene = makeScene([makeRect("a")])
    const before = scene.getElements()

    expect(() =>
      scene.commit((draft) => {
        draft.elements.set("b", makeRect("b"))
        throw new Error("boom")
      }),
    ).toThrow("boom")

    expect(scene.getElements()).toBe(before)
    expect(scene.getElements().has("b")).toBe(false)
    expect(scene.commit(() => {}).elementsChanged).toBe(false)
  })

  it("rejects reentrant and async mutators", () => {
    const scene = makeScene()

    expect(() =>
      scene.commit(() => {
        scene.commit(() => {})
      }),
    ).toThrow(/reentrant/)

    expect(() => scene.commit(async () => {})).toThrow(/synchronous/)
  })

  it("rejects reusing the live scene collections", () => {
    const scene = makeScene([makeRect("a")])

    expect(() =>
      scene.commit((draft) => {
        draft.elements = scene.getElements()
      }),
    ).toThrow(/live scene/)
    expect(() =>
      scene.commit((draft) => {
        draft.selectedIds = scene.getSelectedIds()
      }),
    ).toThrow(/live scene/)
  })

  it("reports no change for a no-op commit", () => {
    const scene = makeScene()
    const rect = makeRect("a")
    scene.commit((draft) => {
      draft.elements.set(rect.id, rect)
    })
    const change = scene.commit(() => {})

    expect(change.elementsChanged).toBe(false)
    expect(change.historyChanged).toBe(false)
    expect(change.selectionChanged).toBe(false)
  })

  it("syncs derived bindings before committing", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("arrow", rect.id)
    const scene = makeScene([rect, arrow])
    const before = scene.getElements().get(arrow.id) as ArrowElement

    scene.commit((draft) => {
      draft.elements.set(rect.id, { ...rect, x: 300 })
    })

    const after = scene.getElements().get(arrow.id) as ArrowElement
    expect(after.endX).toBeGreaterThan(before.endX)
  })
})

describe("Scene replace and select", () => {
  it("adopts a caller-built map and clamps the selection", () => {
    const a = makeRect("a")
    const b = makeRect("b")
    const scene = makeScene([a, b])
    scene.select([a.id])

    const change = scene.replace(new Map([[b.id, b]]))

    expect(change.elementsChanged).toBe(true)
    expect(change.selectionChanged).toBe(true)
    expect([...scene.getElements().keys()]).toEqual(["b"])
    expect(scene.getSelectedIds().size).toBe(0)
  })

  it("resolves an explicit selection against the new elements", () => {
    const a = makeRect("a")
    const b = makeRect("b")
    const scene = makeScene([a, b])

    scene.replace(new Map([[b.id, b]]), { selection: [a.id, b.id] })

    expect([...scene.getSelectedIds()]).toEqual([b.id])
  })

  it("selects only existing ids and always reports the selection", () => {
    const a = makeRect("a")
    const scene = makeScene([a])
    const change = scene.select([a.id, "missing"])
    const again = scene.select([a.id])

    expect([...scene.getSelectedIds()]).toEqual([a.id])
    expect(change.elementsChanged).toBe(false)
    expect(change.selectionChanged).toBe(true)
    expect(again.selectionChanged).toBe(true)
  })
})

describe("Scene history", () => {
  it("suppresses checkpoints inside withoutHistory and rebases them", () => {
    const scene = makeScene()
    const a = makeRect("a")
    const b = makeRect("b")

    scene.withoutHistory(() => {
      scene.commit(
        (draft) => {
          draft.elements.set(a.id, a)
        },
        { history: true },
      )
    })

    expect(scene.canUndo()).toBe(false)
    scene.commit(
      (draft) => {
        draft.elements.set(b.id, b)
      },
      { history: true },
    )
    scene.undo()

    expect(scene.getElements().has(a.id)).toBe(true)
    expect(scene.getElements().has(b.id)).toBe(false)
  })

  it("coalesces nested withoutHistory calls", () => {
    const scene = makeScene()
    const a = makeRect("a")

    scene.withoutHistory(() => {
      scene.withoutHistory(() => {
        scene.commit((draft) => {
          draft.elements.set(a.id, a)
        })
      })
    })

    expect(scene.canUndo()).toBe(false)
    expect(scene.getElements().has(a.id)).toBe(true)
  })

  it("keeps suppression active until an async callback settles", async () => {
    const scene = makeScene()
    const a = makeRect("a")

    await scene.withoutHistory(async () => {
      scene.commit((draft) => {
        draft.elements.set(a.id, a)
      })
      await Promise.resolve()
      scene.commit((draft) => {
        draft.elements.set("b", makeRect("b"))
      })
    })

    expect(scene.canUndo()).toBe(false)
    expect(scene.getElements().has("a")).toBe(true)
    expect(scene.getElements().has("b")).toBe(true)
  })

  it("clearHistory resets both stacks", () => {
    const scene = makeScene()
    scene.commit(
      (draft) => {
        draft.elements.set("a", makeRect("a"))
      },
      { history: true },
    )
    scene.undo()
    expect(scene.canRedo()).toBe(true)

    scene.clearHistory()

    expect(scene.canUndo()).toBe(false)
    expect(scene.canRedo()).toBe(false)
  })

  it("reports an empty change when undo/redo is unavailable", () => {
    const scene = makeScene()
    expect(scene.undo().elementsChanged).toBe(false)
    expect(scene.redo().elementsChanged).toBe(false)
  })
})

describe("Scene ownership", () => {
  it("routes public mutations through commit, replace or select", () => {
    const canvas = new AdrawCanvas()
    const commit = vi.spyOn(Scene.prototype, "commit")
    const replace = vi.spyOn(Scene.prototype, "replace")
    const select = vi.spyOn(Scene.prototype, "select")
    const rect = makeRect("a")

    canvas.addElement(rect)
    canvas.setElements(new Map([[rect.id, rect]]))
    canvas.selectAll()
    canvas.deleteSelected()

    expect(commit).toHaveBeenCalled()
    expect(replace).toHaveBeenCalled()
    expect(select).toHaveBeenCalled()
  })
})
