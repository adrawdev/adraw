import { beforeEach, describe, expect, it } from "vitest"

import { createRectangle } from "../elements"
import type { ToolContext } from "../tools/base"
import { createSelectTool } from "../tools/select"
import type { CanvasElement, ElementId } from "../types"

function makeContext(elements: CanvasElement[]) {
  let elementMap = new Map<ElementId, CanvasElement>(
    elements.map((el) => [el.id, el]),
  )
  let selectedIds = new Set<ElementId>()
  const context: ToolContext = {
    getCanvasSize: () => ({ height: 600, width: 800 }),
    getElements: () => elementMap,
    getSelectedIds: () => selectedIds,
    getStrokeColor: () => "#000",
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    pushHistory: () => {},
    setActiveTool: () => {},
    setElements: (next) => {
      elementMap = next
    },
    setSelectedIds: (next) => {
      selectedIds = next
    },
    setViewport: () => {},
  }
  return context
}

function pointerEvent(anchor: string | null): PointerEvent {
  return {
    ctrlKey: false,
    shiftKey: false,
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

describe("select tool isResizing / isRotating", () => {
  let tool: ReturnType<typeof createSelectTool>
  let context: ToolContext
  let rect: CanvasElement

  beforeEach(() => {
    tool = createSelectTool()
    rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))
  })

  it("starts as not resizing and not rotating", () => {
    expect(tool.isResizing?.()).toBe(false)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("returns true from isResizing when dragging a corner handle", () => {
    tool.onPointerDown(context, { x: 0, y: 0 }, pointerEvent("top-left"))
    expect(tool.isResizing?.()).toBe(true)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("returns true from isResizing when dragging an edge handle", () => {
    tool.onPointerDown(context, { x: 50, y: 0 }, pointerEvent("top-center"))
    expect(tool.isResizing?.()).toBe(true)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("returns true from isResizing when dragging a line handle", () => {
    tool.onPointerDown(context, { x: 0, y: 50 }, pointerEvent("line-start"))
    expect(tool.isResizing?.()).toBe(true)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("returns true from isRotating when dragging the rotation handle", () => {
    tool.onPointerDown(context, { x: 50, y: 0 }, pointerEvent("rotation"))
    expect(tool.isRotating?.()).toBe(true)
    expect(tool.isResizing?.()).toBe(false)
  })

  it("returns to false for both after pointer up", () => {
    tool.onPointerDown(context, { x: 0, y: 0 }, pointerEvent("top-left"))
    tool.onPointerMove(context, { x: 50, y: 50 }, pointerEvent("top-left"))
    tool.onPointerUp(context, { x: 50, y: 50 }, pointerEvent(null))
    expect(tool.isResizing?.()).toBe(false)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("returns to false for both after rotation pointer up", () => {
    tool.onPointerDown(context, { x: 50, y: 0 }, pointerEvent("rotation"))
    tool.onPointerMove(context, { x: 100, y: 50 }, pointerEvent("rotation"))
    tool.onPointerUp(context, { x: 100, y: 50 }, pointerEvent(null))
    expect(tool.isResizing?.()).toBe(false)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("remains false when clicking without a handle", () => {
    tool.onPointerDown(context, { x: 10, y: 10 }, pointerEvent(null))
    expect(tool.isResizing?.()).toBe(false)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("isResizing reflects the current handle type during pointer move", () => {
    tool.onPointerDown(context, { x: 0, y: 0 }, pointerEvent("top-left"))
    expect(tool.isResizing?.()).toBe(true)
    expect(tool.isRotating?.()).toBe(false)

    tool.onPointerMove(context, { x: 50, y: 50 }, pointerEvent("top-left"))
    expect(tool.isResizing?.()).toBe(true)
    expect(tool.isRotating?.()).toBe(false)
  })

  it("isRotating reflects the rotation handle type during pointer move", () => {
    tool.onPointerDown(context, { x: 50, y: 0 }, pointerEvent("rotation"))
    expect(tool.isRotating?.()).toBe(true)
    expect(tool.isResizing?.()).toBe(false)

    tool.onPointerMove(context, { x: 100, y: 50 }, pointerEvent("rotation"))
    expect(tool.isRotating?.()).toBe(true)
    expect(tool.isResizing?.()).toBe(false)
  })
})

describe("select tool multi-selection move", () => {
  it("moves selected elements when dragging from empty space inside their bounds", () => {
    const first = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const second = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 200,
      y: 0,
      zIndex: 1,
    })
    const context = makeContext([first, second])
    context.setSelectedIds(new Set([first.id, second.id]))
    const tool = createSelectTool()

    tool.onPointerDown(context, { x: 150, y: 50 }, pointerEvent(null))
    tool.onPointerMove(context, { x: 175, y: 75 }, pointerEvent(null))
    tool.onPointerUp(context, { x: 175, y: 75 }, pointerEvent(null))

    expect(context.getElements().get(first.id)).toMatchObject({ x: 25, y: 25 })
    expect(context.getElements().get(second.id)).toMatchObject({
      x: 225,
      y: 25,
    })
  })
})
