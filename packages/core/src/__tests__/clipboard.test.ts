// @vitest-environment happy-dom

import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { screenToCanvas } from "../coordinates"
import {
  createGroup,
  createLine,
  createPath,
  createRectangle,
} from "../elements"
import type {
  CanvasElement,
  GroupElement,
  LineElement,
  PathElement,
  RectangleElement,
} from "../types"

function pointerEvent(): PointerEvent {
  return new PointerEvent("pointermove")
}

function makeRectangle(
  id: string,
  x: number,
  y: number,
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

function addElement<T extends CanvasElement>(
  canvas: AdrawCanvas,
  element: T,
): T {
  canvas.getElements().set(element.id, element)
  return element
}

// Create an element through the rectangle tool so the history stack stays
// consistent (the tool pushes a post-mutation entry).
function drawRectangle(
  canvas: AdrawCanvas,
  x: number,
  y: number,
  width = 20,
  height = 20,
): RectangleElement {
  canvas.setActiveTool("rectangle")
  const event = pointerEvent()
  canvas.handlePointerDown(x, y, event)
  canvas.handlePointerMove(x + width, y + height, event)
  canvas.handlePointerUp(x + width, y + height, event)
  return [...canvas.getElements().values()].at(-1) as RectangleElement
}

describe("clipboard", () => {
  it("copy snapshots the selection and paste inserts clones with new ids", () => {
    const canvas = new AdrawCanvas()
    const rect = addElement(canvas, makeRectangle("rect-1", 0, 0))
    canvas.selectAll()

    const copied = canvas.copy()
    expect(copied).toHaveLength(1)
    expect(copied[0].id).toBe(rect.id)

    const pasted = canvas.paste({ x: 100, y: 100 })
    expect(pasted).toHaveLength(1)
    expect(pasted[0].id).not.toBe(rect.id)
    expect(pasted[0].type).toBe("rectangle")
    expect(canvas.getElements().size).toBe(2)
    expect(canvas.getSelectedIds()).toEqual(new Set([pasted[0].id]))
  })

  it("copy snapshots are isolated from later element edits", () => {
    const canvas = new AdrawCanvas()
    const rect = addElement(canvas, makeRectangle("rect-1", 0, 0))
    canvas.selectAll()
    canvas.copy()

    canvas.getElements().set(rect.id, { ...rect, x: 500, y: 500 })
    const pasted = canvas.paste({ x: 0, y: 0 })

    expect(pasted[0].x).toBe(-5)
    expect(pasted[0].y).toBe(-5)
  })

  it("paste centers the bounding box on the given point", () => {
    const canvas = new AdrawCanvas()
    addElement(canvas, makeRectangle("a", 0, 0, 10, 10, 1))
    addElement(canvas, makeRectangle("b", 20, 10, 10, 20, 2))
    canvas.selectAll()
    canvas.copy()

    const pasted = canvas.paste({ x: 100, y: 50 })

    // Source bounds: 0..30 x 0..30, center (15, 15) -> delta (85, 35).
    expect(pasted[0].x).toBe(85)
    expect(pasted[0].y).toBe(35)
    expect(pasted[1].x).toBe(105)
    expect(pasted[1].y).toBe(45)
  })

  it("paste without an explicit point uses the last pointer position", () => {
    const canvas = new AdrawCanvas()
    addElement(canvas, makeRectangle("a", 0, 0, 10, 10))
    canvas.selectAll()
    canvas.copy()

    canvas.handlePointerMove(50, 20, pointerEvent())
    const pasted = canvas.paste()

    const expected = screenToCanvas({ x: 50, y: 20 }, canvas.getViewport(), {
      height: 0,
      width: 0,
    })
    expect(pasted[0].x).toBeCloseTo(expected.x - 5)
    expect(pasted[0].y).toBeCloseTo(expected.y - 5)
  })

  it("paste without a pointer falls back to the viewport center", () => {
    const canvas = new AdrawCanvas({
      initialViewport: { x: 40, y: 60, zoom: 1 },
    })
    addElement(canvas, makeRectangle("a", 0, 0, 10, 10))
    canvas.selectAll()
    canvas.copy()

    const pasted = canvas.paste()

    expect(pasted[0].x).toBe(35)
    expect(pasted[0].y).toBe(55)
  })

  it("paste stacks the clones above the existing elements", () => {
    const canvas = new AdrawCanvas()
    addElement(canvas, makeRectangle("a", 0, 0, 10, 10, 1))
    addElement(canvas, makeRectangle("b", 20, 0, 10, 10, 7))
    canvas.selectAll()
    canvas.copy()

    const pasted = canvas.paste({ x: 0, y: 0 })

    expect(pasted.map((element) => element.zIndex)).toEqual([8, 9])
  })

  it("paste returns an empty array when the clipboard is empty", () => {
    const canvas = new AdrawCanvas()

    expect(canvas.paste({ x: 0, y: 0 })).toEqual([])
    expect(canvas.canUndo()).toBe(false)
  })

  it("copy with an empty selection keeps the previous clipboard content", () => {
    const canvas = new AdrawCanvas()
    addElement(canvas, makeRectangle("a", 0, 0))
    canvas.selectAll()
    canvas.copy()

    canvas.clearSelection()
    expect(canvas.copy()).toEqual([])

    expect(canvas.paste({ x: 0, y: 0 })).toHaveLength(1)
  })

  it("cut copies the selection and deletes it", () => {
    const canvas = new AdrawCanvas()
    drawRectangle(canvas, 0, 0)

    const cut = canvas.cut()

    expect(cut).toHaveLength(1)
    expect(canvas.getElements().size).toBe(0)
    expect(canvas.paste({ x: 0, y: 0 })).toHaveLength(1)
  })

  it("cut is undoable as a single step", () => {
    const canvas = new AdrawCanvas()
    const rect = drawRectangle(canvas, 0, 0)

    canvas.selectAll()
    canvas.cut()
    expect(canvas.getElements().size).toBe(0)

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has(rect.id)).toBe(true)
  })

  it("paste is undoable and redoable", () => {
    const canvas = new AdrawCanvas()
    const rect = drawRectangle(canvas, 0, 0)
    canvas.selectAll()
    canvas.copy()

    const pasted = canvas.paste({ x: 200, y: 200 })
    expect(canvas.getElements().size).toBe(2)

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getElements().has(rect.id)).toBe(true)

    expect(canvas.redo()).toBe(true)
    expect(canvas.getElements().size).toBe(2)
    expect(canvas.getElements().has(pasted[0].id)).toBe(true)
  })

  it("paste selects the clones and switches back to the select tool", () => {
    const canvas = new AdrawCanvas()
    addElement(canvas, makeRectangle("a", 0, 0))
    canvas.selectAll()
    canvas.copy()
    canvas.setActiveTool("draw")

    const pasted = canvas.paste({ x: 0, y: 0 })

    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds()).toEqual(
      new Set(pasted.map((element) => element.id)),
    )
  })

  it("copy includes group children and paste remaps their ids", () => {
    const canvas = new AdrawCanvas()
    const childA = addElement(canvas, makeRectangle("child-a", 0, 0))
    const childB = addElement(canvas, makeRectangle("child-b", 20, 0))
    const group = addElement(
      canvas,
      createGroup({
        children: [childA.id, childB.id],
        height: 10,
        locked: false,
        rotation: 0,
        visible: true,
        width: 30,
        x: 0,
        y: 0,
        zIndex: 3,
      }),
    )
    canvas.setSelectedIds(new Set([group.id]))

    const copied = canvas.copy()
    expect(copied).toHaveLength(3)

    const pasted = canvas.paste({ x: 0, y: 0 })
    expect(pasted).toHaveLength(3)

    const pastedGroup = pasted.find(
      (element) => element.type === "group",
    ) as GroupElement
    const pastedIds = new Set(pasted.map((element) => element.id))
    expect(pastedGroup.children).toHaveLength(2)
    for (const childId of pastedGroup.children) {
      expect(pastedIds.has(childId)).toBe(true)
      expect(childId).not.toBe(childA.id)
      expect(childId).not.toBe(childB.id)
    }
  })

  it("paste translates line endpoints and path points", () => {
    const canvas = new AdrawCanvas()
    addElement(
      canvas,
      createLine({
        endX: 40,
        endY: 30,
        height: 30,
        locked: false,
        rotation: 0,
        startX: 10,
        startY: 0,
        strokeColor: "#000",
        strokeWidth: 1,
        visible: true,
        width: 30,
        x: 10,
        y: 0,
        zIndex: 1,
      }),
    )
    addElement(
      canvas,
      createPath({
        height: 10,
        locked: false,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        rotation: 0,
        strokeColor: "#000",
        strokeWidth: 1,
        visible: true,
        width: 10,
        x: 0,
        y: 0,
        zIndex: 2,
      }),
    )
    canvas.selectAll()
    canvas.copy()

    // Source bounds 0..40 x 0..30, center (20, 15); target (100, 100) -> (80, 85).
    const pasted = canvas.paste({ x: 100, y: 100 })

    const line = pasted.find(
      (element) => element.type === "line",
    ) as LineElement
    expect(line.startX).toBe(90)
    expect(line.startY).toBe(85)
    expect(line.endX).toBe(120)
    expect(line.endY).toBe(115)
    expect(line.x).toBe(90)
    expect(line.y).toBe(85)

    const path = pasted.find(
      (element) => element.type === "path",
    ) as PathElement
    expect(path.points).toEqual([
      { x: 80, y: 85 },
      { x: 90, y: 95 },
    ])
  })

  it("serializeClipboard round-trips through JSON", () => {
    const source = new AdrawCanvas()
    addElement(source, makeRectangle("a", 0, 0))
    source.selectAll()
    source.copy()

    const text = source.serializeClipboard()
    expect(text).not.toBeNull()

    const target = new AdrawCanvas()
    expect(target.deserializeClipboard(text!)).toBe(true)
    const pasted = target.paste({ x: 0, y: 0 })

    expect(pasted).toHaveLength(1)
    expect(pasted[0].type).toBe("rectangle")
  })

  it("serializeClipboard returns null when the clipboard is empty", () => {
    const canvas = new AdrawCanvas()

    expect(canvas.serializeClipboard()).toBeNull()
  })

  it("deserializeClipboard rejects invalid data and keeps the buffer", () => {
    const canvas = new AdrawCanvas()
    addElement(canvas, makeRectangle("a", 0, 0))
    canvas.selectAll()
    canvas.copy()

    expect(canvas.deserializeClipboard("not json")).toBe(false)
    expect(
      canvas.deserializeClipboard(
        JSON.stringify({ elements: [], type: "adraw/clipboard", version: 1 }),
      ),
    ).toBe(false)
    expect(canvas.deserializeClipboard(JSON.stringify({ nope: true }))).toBe(
      false,
    )

    expect(canvas.paste({ x: 0, y: 0 })).toHaveLength(1)
  })

  it("uses custom serialize and deserialize hooks when provided", () => {
    const serialize = (elements: CanvasElement[]): string =>
      `custom:${JSON.stringify(elements)}`
    const deserialize = (data: string): CanvasElement[] | null =>
      data.startsWith("custom:")
        ? (JSON.parse(data.slice("custom:".length)) as CanvasElement[])
        : null

    const source = new AdrawCanvas({ clipboard: { serialize } })
    addElement(source, makeRectangle("a", 0, 0))
    source.selectAll()
    source.copy()

    const text = source.serializeClipboard()
    expect(text).not.toBeNull()
    expect(text!.startsWith("custom:")).toBe(true)

    const target = new AdrawCanvas({ clipboard: { deserialize } })
    expect(target.deserializeClipboard(text!)).toBe(true)
    expect(target.paste({ x: 0, y: 0 })).toHaveLength(1)
  })

  it("Ctrl/Cmd+C, X and V drive copy, cut and paste", () => {
    const canvas = new AdrawCanvas()
    const rect = drawRectangle(canvas, 0, 0)

    canvas.handleKeyDown(
      new KeyboardEvent("keydown", { ctrlKey: true, key: "c" }),
    )
    canvas.handleKeyDown(
      new KeyboardEvent("keydown", { ctrlKey: true, key: "x" }),
    )
    expect(canvas.getElements().size).toBe(0)

    canvas.handleKeyDown(
      new KeyboardEvent("keydown", { key: "v", metaKey: true }),
    )
    expect(canvas.getElements().size).toBe(1)
    const pasted = [...canvas.getElements().values()][0]
    expect(pasted.id).not.toBe(rect.id)
  })
})
