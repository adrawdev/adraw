// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createPath, createRectangle } from "../elements"
import type { ElementId, PathElement, RectangleElement } from "../types"

// The canvas maps screen → canvas coordinates by subtracting half the canvas
// size (set to 800×600 below), so a canvas point (x, y) is the screen point
// (x + 400, y + 300).
const SCREEN_OFFSET = { x: 400, y: 300 }

function screenOf(x: number, y: number): { screenX: number; screenY: number } {
  return { screenX: x + SCREEN_OFFSET.x, screenY: y + SCREEN_OFFSET.y }
}

function makeRect(x: number, y: number): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 50,
    locked: false,
    rotation: 0,
    strokeColor: "#000000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x,
    y,
    zIndex: 0,
  })
}

function mount(): { canvas: AdrawCanvas; container: HTMLElement } {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
    },
  )
  const container = document.createElement("div")
  document.body.appendChild(container)
  const canvas = new AdrawCanvas({ container })
  canvas.setCanvasSize(800, 600)
  return { canvas, container }
}

function dispatchPointer(
  container: HTMLElement,
  type: string,
  screenX: number,
  screenY: number,
): void {
  const svg = container.querySelector("svg")!
  svg.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: screenX,
      clientY: screenY,
      pointerId: 1,
    }),
  )
}

// Draw a rectangle with the rectangle tool and return the committed element.
function dragRectangle(
  canvas: AdrawCanvas,
  container: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): RectangleElement {
  const before = new Set(canvas.getElements().keys())
  canvas.setActiveTool("rectangle")
  const start = screenOf(from.x, from.y)
  const end = screenOf(to.x, to.y)
  dispatchPointer(container, "pointerdown", start.screenX, start.screenY)
  dispatchPointer(container, "pointermove", end.screenX, end.screenY)
  dispatchPointer(container, "pointerup", end.screenX, end.screenY)
  // Drop the lingering temporary node so only committed nodes remain.
  canvas.render()

  const id = [...canvas.getElements().keys()].find((key) => !before.has(key))
  if (!id) {
    throw new Error("rectangle drag committed no element")
  }
  return canvas.getElements().get(id) as RectangleElement
}

function nodesFor(container: HTMLElement, id: ElementId): SVGGElement[] {
  return [...container.querySelectorAll<SVGGElement>("[id]")].filter(
    (node) => node.id === id,
  )
}

function nodeFor(container: HTMLElement, id: ElementId): SVGGElement {
  const node = nodesFor(container, id)[0]
  if (!node) {
    throw new Error(`no DOM node for element ${id}`)
  }
  return node
}

function emitChange(canvas: AdrawCanvas): void {
  canvas.emit("change", { elements: canvas.getElements() })
}

describe("element node reconciliation", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("rewrites only the dragged element's node and keeps node identity", () => {
    const { canvas, container } = mount()
    const a = dragRectangle(
      canvas,
      container,
      { x: 10, y: 10 },
      { x: 110, y: 60 },
    )
    const b = dragRectangle(
      canvas,
      container,
      { x: 200, y: 200 },
      { x: 300, y: 250 },
    )

    // Clear the selection left over from the second commit so the drag below
    // doesn't toggle the selection class on unrelated nodes.
    const empty = screenOf(400, 400)
    dispatchPointer(container, "pointerdown", empty.screenX, empty.screenY)
    dispatchPointer(container, "pointerup", empty.screenX, empty.screenY)

    const nodeA = nodeFor(container, a.id)
    const nodeB = nodeFor(container, b.id)
    const spyA = vi.spyOn(nodeA, "setAttribute")
    const spyB = vi.spyOn(nodeB, "setAttribute")

    const start = screenOf(a.x + a.width / 2, a.y + a.height / 2)
    dispatchPointer(container, "pointerdown", start.screenX, start.screenY)
    dispatchPointer(
      container,
      "pointermove",
      start.screenX + 60,
      start.screenY + 60,
    )
    dispatchPointer(
      container,
      "pointerup",
      start.screenX + 60,
      start.screenY + 60,
    )

    expect(canvas.getElements().get(a.id)!.x).toBe(70)
    expect(nodeFor(container, a.id)).toBe(nodeA)
    expect(nodeFor(container, b.id)).toBe(nodeB)
    expect(spyA).toHaveBeenCalled()
    expect(spyB).not.toHaveBeenCalled()
    expect(nodeA.getAttribute("transform")).toContain("translate(70, 70)")
  })

  it("rewrites a node when its element is mutated in place", () => {
    const { canvas, container } = mount()
    const a = dragRectangle(
      canvas,
      container,
      { x: 10, y: 10 },
      { x: 110, y: 60 },
    )
    const nodeA = nodeFor(container, a.id)

    const element = canvas.getElements().get(a.id)!
    element.x = 123.5
    emitChange(canvas)

    expect(nodeFor(container, a.id)).toBe(nodeA)
    expect(nodeA.getAttribute("transform")).toContain("123.5")
  })

  it("drops hidden elements' nodes and recreates them when visible again", () => {
    const { canvas, container } = mount()
    const a = dragRectangle(
      canvas,
      container,
      { x: 10, y: 10 },
      { x: 110, y: 60 },
    )
    const element = canvas.getElements().get(a.id)!

    element.visible = false
    emitChange(canvas)
    expect(nodesFor(container, a.id)).toHaveLength(0)

    element.visible = true
    emitChange(canvas)
    const recreated = nodeFor(container, a.id)
    expect(recreated.querySelector("rect")?.getAttribute("width")).toBe("100")

    // The recreated node must be tracked again by the node cache.
    const spy = vi.spyOn(recreated, "setAttribute")
    element.x = 5
    emitChange(canvas)
    expect(spy).toHaveBeenCalled()
  })

  it("drops nodes for deleted elements and keeps the rest untouched", () => {
    const { canvas, container } = mount()
    const a = dragRectangle(
      canvas,
      container,
      { x: 10, y: 10 },
      { x: 110, y: 60 },
    )
    const b = dragRectangle(
      canvas,
      container,
      { x: 200, y: 200 },
      { x: 300, y: 250 },
    )

    canvas.getElements().delete(a.id)
    emitChange(canvas)
    expect(nodesFor(container, a.id)).toHaveLength(0)

    const nodeB = nodeFor(container, b.id)
    const spyB = vi.spyOn(nodeB, "setAttribute")
    emitChange(canvas)
    expect(nodeFor(container, b.id)).toBe(nodeB)
    expect(spyB).not.toHaveBeenCalled()
  })

  it("rewrites exactly one node among many when one element changes", () => {
    const { canvas, container } = mount()
    const rects = Array.from({ length: 40 }, (_, index) =>
      makeRect(index * 10, index * 10),
    )
    for (const rect of rects) {
      canvas.getElements().set(rect.id, rect)
    }
    emitChange(canvas)

    const spies = rects.map((rect) =>
      vi.spyOn(nodeFor(container, rect.id), "setAttribute"),
    )
    const targetIndex = 20
    canvas.getElements().set(rects[targetIndex].id, {
      ...rects[targetIndex],
      x: rects[targetIndex].x + 3,
    })
    emitChange(canvas)

    const written = spies
      .map((spy, index) => (spy.mock.calls.length > 0 ? index : -1))
      .filter((index) => index >= 0)
    expect(written).toEqual([targetIndex])
  })

  it("rebuilds a path's d when its points are replaced", () => {
    const { canvas, container } = mount()
    const path: PathElement = createPath({
      height: 10,
      locked: false,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ],
      rotation: 0,
      strokeColor: "#000000",
      strokeWidth: 2,
      visible: true,
      width: 20,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    canvas.getElements().set(path.id, path)
    emitChange(canvas)

    const node = nodeFor(container, path.id)
    const pathNode = node.querySelector("path")!
    const dBefore = pathNode.getAttribute("d")

    canvas.getElements().set(path.id, {
      ...path,
      points: [{ x: 5, y: 5 }, ...path.points],
    })
    emitChange(canvas)
    expect(pathNode.getAttribute("d")).not.toBe(dBefore)

    // An unchanged element must not be rewritten at all.
    const spy = vi.spyOn(node.querySelector("path")!, "setAttribute")
    emitChange(canvas)
    expect(spy).not.toHaveBeenCalled()
  })

  it("adopts the temporary node when the text tool commits under the same id", () => {
    const { canvas, container } = mount()
    canvas.setActiveTool("text")

    const at = screenOf(20, 20)
    dispatchPointer(container, "pointerdown", at.screenX, at.screenY)

    const preview = container.querySelector(".adraw-temporary") as SVGGElement
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")!
    editor.value = "Hello"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    )

    const element = [...canvas.getElements().values()][0]
    const committed = nodesFor(container, element.id)
    expect(committed).toHaveLength(1)
    expect(committed[0]).toBe(preview)

    // The adopted node must be tracked by the node cache for later edits.
    element.text = "Changed"
    emitChange(canvas)
    expect(committed[0].querySelector("text")?.textContent).toBe("Changed")
  })
})
