import { describe, expect, it } from "vitest"

import { calculateShapeBounds, type ToolContext } from "../tools/base"
import { createEllipseTool } from "../tools/ellipse"
import { createRectangleTool } from "../tools/rectangle"
import type {
  CanvasElement,
  ElementId,
  EllipseElement,
  RectangleElement,
} from "../types"

function makeContext(elements: CanvasElement[] = []) {
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

function pointerEvent(shiftKey = false, altKey = false): PointerEvent {
  return { altKey, shiftKey } as PointerEvent
}

describe("calculateShapeBounds", () => {
  it("returns the plain drag bounds without modifiers", () => {
    expect(calculateShapeBounds({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual({
      height: 50,
      signedHeight: 50,
      signedWidth: 100,
      width: 100,
      x: 10,
      y: 20,
    })
  })

  it("squares the bounds around the larger axis when constrained", () => {
    expect(
      calculateShapeBounds(
        { x: 10, y: 20 },
        { x: 110, y: 70 },
        { constrainProportions: true },
      ),
    ).toEqual({
      height: 100,
      signedHeight: 100,
      signedWidth: 100,
      width: 100,
      x: 10,
      y: 20,
    })
  })

  it("keeps the constrained square in the drag direction", () => {
    expect(
      calculateShapeBounds(
        { x: 100, y: 100 },
        { x: 40, y: 20 },
        { constrainProportions: true },
      ),
    ).toEqual({
      height: 80,
      signedHeight: -80,
      signedWidth: -80,
      width: 80,
      x: 20,
      y: 20,
    })
  })

  it("doubles the drag extents around the start point from center", () => {
    expect(
      calculateShapeBounds(
        { x: 100, y: 100 },
        { x: 150, y: 130 },
        { fromCenter: true },
      ),
    ).toEqual({
      height: 60,
      signedHeight: 60,
      signedWidth: 100,
      width: 100,
      x: 50,
      y: 70,
    })
  })

  it("combines constrain and from-center for a centered square", () => {
    expect(
      calculateShapeBounds(
        { x: 100, y: 100 },
        { x: 150, y: 120 },
        { constrainProportions: true, fromCenter: true },
      ),
    ).toEqual({
      height: 100,
      signedHeight: 100,
      signedWidth: 100,
      width: 100,
      x: 50,
      y: 50,
    })
  })

  it("keeps the base box proportions when constrained", () => {
    expect(
      calculateShapeBounds(
        { x: 0, y: 0 },
        { x: 300, y: 50 },
        {
          base: { height: 100, width: 200, x: 0, y: 0 },
          constrainProportions: true,
        },
      ),
    ).toEqual({
      height: 150,
      signedHeight: 150,
      signedWidth: 300,
      width: 300,
      x: 0,
      y: 0,
    })
  })

  it("signs the drag outwards from a resize handle", () => {
    expect(
      calculateShapeBounds(
        { x: 100, y: 50 },
        { x: 150, y: 50 },
        {
          base: { height: 100, width: 100, x: 0, y: 0 },
          changes: { height: false, width: true },
          direction: { x: -1, y: 1 },
        },
      ),
    ).toEqual({
      height: 100,
      signedHeight: 100,
      signedWidth: -50,
      width: 50,
      x: 50,
      y: 0,
    })
  })

  it("centers the constrained axis a drag doesn't change", () => {
    expect(
      calculateShapeBounds(
        { x: 210, y: 70 },
        { x: 610, y: 70 },
        {
          base: { height: 100, width: 200, x: 10, y: 20 },
          changes: { height: false, width: true },
          constrainProportions: true,
        },
      ),
    ).toEqual({
      height: 200,
      signedHeight: 200,
      signedWidth: 400,
      width: 400,
      x: 210,
      y: -30,
    })
  })
})

describe("rectangle tool modifiers", () => {
  it("creates a temporary rectangle on pointer move", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 110, y: 70 }, pointerEvent())

    const temp = tool.getTemporaryElement() as RectangleElement
    expect(temp.type).toBe("rectangle")
    expect(temp.x).toBe(10)
    expect(temp.y).toBe(20)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(50)
  })

  it("constrains to a square with Shift, using the larger drag axis", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 110, y: 70 }, pointerEvent(true))

    const temp = tool.getTemporaryElement() as RectangleElement
    expect(temp.x).toBe(10)
    expect(temp.y).toBe(20)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(100)
  })

  it("sizes from the center with Alt", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 100, y: 100 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 150, y: 130 }, pointerEvent(false, true))

    const temp = tool.getTemporaryElement() as RectangleElement
    expect(temp.x).toBe(50)
    expect(temp.y).toBe(70)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(60)
  })

  it("combines Shift and Alt for a centered square", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 100, y: 100 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 150, y: 120 }, pointerEvent(true, true))

    const temp = tool.getTemporaryElement() as RectangleElement
    expect(temp.x).toBe(50)
    expect(temp.y).toBe(50)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(100)
  })

  it("commits the Shift-constrained square on pointer up", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()
    const event = pointerEvent(true)

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    tool.onPointerMove(ctx, { x: 110, y: 70 }, event)
    tool.onPointerUp(ctx, { x: 110, y: 70 }, event)

    expect(ctx.getElements().size).toBe(1)
    const rect = ctx.getElements().values().next().value as RectangleElement
    expect(rect.x).toBe(10)
    expect(rect.y).toBe(20)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(100)
    expect(ctx.historyCount()).toBe(1)
  })

  it("commits the Alt centered rectangle on pointer up", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()
    const event = pointerEvent(false, true)

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 100, y: 100 }, event)
    tool.onPointerMove(ctx, { x: 150, y: 130 }, event)
    tool.onPointerUp(ctx, { x: 150, y: 130 }, event)

    expect(ctx.getElements().size).toBe(1)
    const rect = ctx.getElements().values().next().value as RectangleElement
    expect(rect.x).toBe(50)
    expect(rect.y).toBe(70)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(60)
  })

  it("does not commit when the drag is too small", () => {
    const tool = createRectangleTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 13, y: 23 }, pointerEvent())
    tool.onPointerUp(ctx, { x: 13, y: 23 }, pointerEvent())

    expect(ctx.getElements().size).toBe(0)
    expect(ctx.historyCount()).toBe(0)
  })
})

describe("ellipse tool modifiers", () => {
  it("creates a temporary ellipse on pointer move", () => {
    const tool = createEllipseTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 110, y: 70 }, pointerEvent())

    const temp = tool.getTemporaryElement() as EllipseElement
    expect(temp.type).toBe("ellipse")
    expect(temp.x).toBe(10)
    expect(temp.y).toBe(20)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(50)
  })

  it("constrains to a circle with Shift", () => {
    const tool = createEllipseTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 60, y: 120 }, pointerEvent(true))

    const temp = tool.getTemporaryElement() as EllipseElement
    expect(temp.x).toBe(10)
    expect(temp.y).toBe(20)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(100)
  })

  it("sizes from the center with Alt", () => {
    const tool = createEllipseTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 100, y: 100 }, pointerEvent())
    tool.onPointerMove(ctx, { x: 150, y: 130 }, pointerEvent(false, true))

    const temp = tool.getTemporaryElement() as EllipseElement
    expect(temp.x).toBe(50)
    expect(temp.y).toBe(70)
    expect(temp.width).toBe(100)
    expect(temp.height).toBe(60)
  })

  it("commits the Shift-constrained circle on pointer up", () => {
    const tool = createEllipseTool()
    const ctx = makeContext()
    const event = pointerEvent(true)

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    tool.onPointerMove(ctx, { x: 60, y: 120 }, event)
    tool.onPointerUp(ctx, { x: 60, y: 120 }, event)

    expect(ctx.getElements().size).toBe(1)
    const ellipse = ctx.getElements().values().next().value as EllipseElement
    expect(ellipse.type).toBe("ellipse")
    expect(ellipse.x).toBe(10)
    expect(ellipse.y).toBe(20)
    expect(ellipse.width).toBe(100)
    expect(ellipse.height).toBe(100)
  })

  it("commits the Alt centered ellipse on pointer up", () => {
    const tool = createEllipseTool()
    const ctx = makeContext()
    const event = pointerEvent(false, true)

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 100, y: 100 }, event)
    tool.onPointerMove(ctx, { x: 150, y: 130 }, event)
    tool.onPointerUp(ctx, { x: 150, y: 130 }, event)

    expect(ctx.getElements().size).toBe(1)
    const ellipse = ctx.getElements().values().next().value as EllipseElement
    expect(ellipse.x).toBe(50)
    expect(ellipse.y).toBe(70)
    expect(ellipse.width).toBe(100)
    expect(ellipse.height).toBe(60)
  })
})
