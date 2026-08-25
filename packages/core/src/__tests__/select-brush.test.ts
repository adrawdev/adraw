import { beforeEach, describe, expect, it } from "vitest"

import { createRectangle } from "../elements"
import type { ToolContext } from "../tools/base"
import { createSelectTool } from "../tools/select"
import type { CanvasElement, ElementId, Point } from "../types"

function makeContext(elements: CanvasElement[]) {
  let elementMap = new Map<ElementId, CanvasElement>(
    elements.map((el) => [el.id, el]),
  )
  let selectedIds = new Set<ElementId>()
  let historyCount = 0
  const context: ToolContext & { historyCount: () => number } = {
    getCanvasSize: () => ({ height: 600, width: 800 }),
    getElements: () => elementMap,
    getSelectedIds: () => selectedIds,
    getStrokeColor: () => "#000",
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    historyCount: () => historyCount,
    pushHistory: () => {
      historyCount += 1
    },
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

// The select tool only reads `target.getAttribute("data-anchor")` and the
// modifier flags off the pointer event.
function pointerEvent(
  anchor: string | null,
  modifiers: { shiftKey?: boolean; ctrlKey?: boolean } = {},
): PointerEvent {
  return {
    ctrlKey: modifiers.ctrlKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

function rect(x: number, y: number, id: string): CanvasElement {
  return createRectangle({
    cornerRadius: 0,
    height: 40,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 40,
    x,
    y,
    zIndex: 0,
  })
}

function brush(
  tool: ReturnType<typeof createSelectTool>,
  context: ToolContext,
  from: Point,
  to: Point,
  event = pointerEvent(null),
) {
  tool.onPointerDown(context, from, event)
  tool.onPointerMove(context, to, event)
}

describe("select tool marquee (brushing) selection", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("selects elements whose bounds the marquee touches", () => {
    // a: (0,0)-(40,40), b: (100,100)-(140,140), c far away
    const context = makeContext([
      rect(0, 0, "a"),
      rect(100, 100, "b"),
      rect(500, 500, "c"),
    ])

    brush(tool, context, { x: -10, y: -10 }, { x: 120, y: 120 })

    expect([...context.getSelectedIds()].toSorted()).toEqual(["a", "b"])
  })

  it("exposes the marquee box while dragging and clears it on pointer up", () => {
    const context = makeContext([rect(300, 300, "a")])

    tool.onPointerDown(context, { x: 10, y: 20 }, pointerEvent(null))
    tool.onPointerMove(context, { x: 60, y: 100 }, pointerEvent(null))

    expect(tool.getSelectionBox?.()).toEqual({
      height: 80,
      width: 50,
      x: 10,
      y: 20,
    })

    tool.onPointerUp(context, { x: 60, y: 100 }, pointerEvent(null))
    expect(tool.getSelectionBox?.()).toBeNull()
  })

  it("re-evaluates the selection as the marquee shrinks", () => {
    const context = makeContext([rect(0, 0, "a"), rect(100, 100, "b")])

    tool.onPointerDown(context, { x: -10, y: -10 }, pointerEvent(null))
    tool.onPointerMove(context, { x: 150, y: 150 }, pointerEvent(null))
    expect([...context.getSelectedIds()].toSorted()).toEqual(["a", "b"])

    // Shrink the marquee back so it only touches "a".
    tool.onPointerMove(context, { x: 30, y: 30 }, pointerEvent(null))
    expect([...context.getSelectedIds()]).toEqual(["a"])
  })

  it("unions the marquee onto the existing selection with the multi-select modifier", () => {
    const context = makeContext([rect(0, 0, "a"), rect(100, 100, "b")])
    context.setSelectedIds(new Set(["a"]))

    brush(
      tool,
      context,
      { x: 90, y: 90 },
      { x: 150, y: 150 },
      pointerEvent(null, { shiftKey: true }),
    )

    expect([...context.getSelectedIds()].toSorted()).toEqual(["a", "b"])
  })

  it("clears the selection on a plain click in empty space", () => {
    const context = makeContext([rect(0, 0, "a")])
    context.setSelectedIds(new Set(["a"]))

    tool.onPointerDown(context, { x: 300, y: 300 }, pointerEvent(null))
    tool.onPointerUp(context, { x: 300, y: 300 }, pointerEvent(null))

    expect(context.getSelectedIds().size).toBe(0)
  })

  it("skips locked and hidden elements", () => {
    const locked = rect(0, 0, "locked")
    locked.locked = true
    const hidden = rect(100, 100, "hidden")
    hidden.visible = false
    const context = makeContext([locked, hidden, rect(200, 200, "c")])

    brush(tool, context, { x: -10, y: -10 }, { x: 250, y: 250 })

    expect([...context.getSelectedIds()]).toEqual(["c"])
  })

  it("does not push history for a marquee selection", () => {
    const context = makeContext([rect(0, 0, "a")])

    tool.onPointerDown(context, { x: -10, y: -10 }, pointerEvent(null))
    tool.onPointerMove(context, { x: 50, y: 50 }, pointerEvent(null))
    tool.onPointerUp(context, { x: 50, y: 50 }, pointerEvent(null))

    expect(
      (context as ToolContext & { historyCount: () => number }).historyCount(),
    ).toBe(0)
  })
})
