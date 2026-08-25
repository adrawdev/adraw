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

describe("select tool deactivation", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("clears selectedIds when there was a selection", () => {
    const rect = createRectangle({
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
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    tool.onDeactivate(context)

    expect(context.getSelectedIds().size).toBe(0)
  })

  it("handles deactivation when there is no selection", () => {
    const rect = createRectangle({
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
    const context = makeContext([rect])

    expect(() => tool.onDeactivate(context)).not.toThrow()
    expect(context.getSelectedIds().size).toBe(0)
  })

  it("resets isResizing and isRotating to false", () => {
    const rect = createRectangle({
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
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    tool.onPointerDown(context, { x: 0, y: 0 }, pointerEvent("top-left"))
    expect(tool.isResizing?.()).toBe(true)

    tool.onDeactivate(context)

    expect(tool.isResizing?.()).toBe(false)
    expect(tool.isRotating?.()).toBe(false)
  })
})
