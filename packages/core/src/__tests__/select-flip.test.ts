import { beforeEach, describe, expect, it } from "vitest"

import { createPath, createRectangle } from "../elements"
import type { ToolContext } from "../tools/base"
import { createSelectTool } from "../tools/select"
import type { CanvasElement, ElementId, Point } from "../types"

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

// Pointer events in tests only need `target.getAttribute("data-anchor")` and
// the modifier flags the select tool reads.
function pointerEvent(
  anchor: string | null,
  modifiers: { altKey?: boolean; shiftKey?: boolean } = {},
): PointerEvent {
  return {
    altKey: modifiers.altKey ?? false,
    ctrlKey: false,
    shiftKey: modifiers.shiftKey ?? false,
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

function dragHandle(
  tool: ReturnType<typeof createSelectTool>,
  context: ToolContext,
  anchor: string,
  from: Point,
  to: Point,
  modifiers: { altKey?: boolean; shiftKey?: boolean } = {},
) {
  tool.onPointerDown(context, from, pointerEvent(anchor, modifiers))
  tool.onPointerMove(context, to, pointerEvent(anchor, modifiers))
  tool.onPointerUp(context, to, pointerEvent(null))
}

describe("select tool multi-element rotation", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("orbits elements around the selection center when rotating multiple", () => {
    const a = createRectangle({
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
    const b = createRectangle({
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
      zIndex: 0,
    })
    const context = makeContext([a, b])
    context.setSelectedIds(new Set([a.id, b.id]))

    // Selection bounds: x=0, y=0, width=300, height=100 → center at (150, 50).
    // Drag from (150, 0) to (250, 50): startAngle = atan2(-50, 0) = -90°,
    // currentAngle = atan2(0, 100) = 0°, deltaAngle = 90°.
    // Element A center (50, 50) orbits to (150, -50) → x=100, y=-100.
    // Element B center (250, 50) orbits to (150, 150) → x=100, y=100.
    dragHandle(tool, context, "rotation", { x: 150, y: 0 }, { x: 250, y: 50 })

    const resultA = context.getElements().get(a.id)!
    expect(resultA.rotation % 360).toBeCloseTo(90)
    expect(resultA.x).toBeCloseTo(100)
    expect(resultA.y).toBeCloseTo(-100)

    const resultB = context.getElements().get(b.id)!
    expect(resultB.rotation % 360).toBeCloseTo(90)
    expect(resultB.x).toBeCloseTo(100)
    expect(resultB.y).toBeCloseTo(100)
  })

  it("rotates a single element in place without orbiting", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 100,
      y: 100,
      zIndex: 0,
    })
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    // Single element: rotation center is its own center (150, 150).
    // Drag from above to the right: 90° rotation.
    dragHandle(
      tool,
      context,
      "rotation",
      { x: 150, y: 100 },
      { x: 250, y: 150 },
    )

    const result = context.getElements().get(rect.id)!
    // Single element rotates in place — only its rotation changes.
    expect(result.rotation % 360).toBeCloseTo(90)
    expect(result.x).toBeCloseTo(100)
    expect(result.y).toBeCloseTo(100)
  })
})

describe("select tool resize flipping", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("flips a rectangle horizontally when the left handle is dragged past the right edge", () => {
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

    // Right edge (the anchor for a left-center handle) sits at x=100.
    // Drag the left-center handle from x=0 to x=150 — 50px past the anchor.
    dragHandle(tool, context, "left-center", { x: 0, y: 50 }, { x: 150, y: 50 })

    const result = context.getElements().get(rect.id)!
    // The box now lives to the right of the anchor: x in [100, 150].
    expect(result.x).toBeCloseTo(100)
    expect(result.width).toBeCloseTo(50)
    expect(result.height).toBeCloseTo(100)
  })

  it("flips a rectangle vertically when the top handle is dragged past the bottom edge", () => {
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

    // Bottom edge (anchor for top-center) is y=100; drag from y=0 to y=160.
    dragHandle(tool, context, "top-center", { x: 50, y: 0 }, { x: 50, y: 160 })

    const result = context.getElements().get(rect.id)!
    expect(result.y).toBeCloseTo(100)
    expect(result.height).toBeCloseTo(60)
    expect(result.width).toBeCloseTo(100)
  })

  it("mirrors a path's points when a corner handle is dragged across the anchor", () => {
    // An L-shaped path so the mirror is observable: points at the bbox edges.
    const path = createPath({
      height: 100,
      locked: false,
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ],
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const context = makeContext([path])
    context.setSelectedIds(new Set([path.id]))

    // top-left handle anchors at the bottom-right corner (100, 100).
    // Drag it to (200, 100): horizontally past the anchor, no vertical change.
    dragHandle(tool, context, "top-left", { x: 0, y: 0 }, { x: 200, y: 100 })

    const result = context.getElements().get(path.id)
    if (result?.type !== "path") {
      throw new Error("expected path")
    }
    // Mirrored across x=100: x=0 -> 200, x=100 -> 100. Bbox is [100, 200].
    expect(result.x).toBeCloseTo(100)
    expect(result.width).toBeCloseTo(100)
    const xs = result.points.map((p) => p.x).toSorted((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(100)
    expect(xs[xs.length - 1]).toBeCloseTo(200)
  })

  it("keeps a non-flipped resize behaving normally", () => {
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

    // Drag the right-center handle outward from x=100 to x=200.
    dragHandle(
      tool,
      context,
      "right-center",
      { x: 100, y: 50 },
      { x: 200, y: 50 },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(0)
    expect(result.width).toBeCloseTo(200)
  })

  it("resizes a corner from the selection center when Alt is held", () => {
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

    dragHandle(
      tool,
      context,
      "top-left",
      { x: 0, y: 0 },
      { x: -50, y: -50 },
      { altKey: true },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(-50)
    expect(result.y).toBeCloseTo(-50)
    expect(result.width).toBeCloseTo(200)
    expect(result.height).toBeCloseTo(200)
  })

  it("resizes an edge from the selection center when Alt is held", () => {
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

    dragHandle(
      tool,
      context,
      "right-center",
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { altKey: true },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(-100)
    expect(result.width).toBeCloseTo(300)
    expect(result.y).toBeCloseTo(0)
    expect(result.height).toBeCloseTo(100)
  })

  it("scales every selected element around the selection center when Alt is held", () => {
    const first = createRectangle({
      cornerRadius: 0,
      height: 100,
      id: "first",
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
      id: "second",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 200,
      y: 0,
      zIndex: 0,
    })
    const context = makeContext([first, second])
    context.setSelectedIds(new Set([first.id, second.id]))

    // Selection bounds are 300x100 with center (150, 50). Doubling its size
    // around the center gives bounds x=-150, width=600.
    dragHandle(
      tool,
      context,
      "bottom-right",
      { x: 300, y: 100 },
      { x: 450, y: 150 },
      { altKey: true },
    )

    const resultFirst = context.getElements().get(first.id)!
    expect(resultFirst.x).toBeCloseTo(-150)
    expect(resultFirst.width).toBeCloseTo(200)
    expect(resultFirst.y).toBeCloseTo(-50)
    expect(resultFirst.height).toBeCloseTo(200)

    const resultSecond = context.getElements().get(second.id)!
    expect(resultSecond.x).toBeCloseTo(250)
    expect(resultSecond.width).toBeCloseTo(200)
    expect(resultSecond.y).toBeCloseTo(-50)
    expect(resultSecond.height).toBeCloseTo(200)
  })

  it("constrains a corner resize to the original proportions while Shift is held", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 200,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    // Shift is pressed during the move, rather than at pointer-down. The
    // horizontal drag is dominant, so the 2:1 ratio gives a 300x150 box.
    dragHandle(
      tool,
      context,
      "top-left",
      { x: 0, y: 0 },
      { x: -100, y: -25 },
      { shiftKey: true },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(-100)
    expect(result.y).toBeCloseTo(-50)
    expect(result.width).toBeCloseTo(300)
    expect(result.height).toBeCloseTo(150)
  })

  it("constrains an edge resize around the opposite edge midpoint", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 200,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    dragHandle(
      tool,
      context,
      "right-center",
      { x: 200, y: 50 },
      { x: 400, y: 50 },
      { shiftKey: true },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(-50)
    expect(result.width).toBeCloseTo(400)
    expect(result.height).toBeCloseTo(200)
  })

  it("constrains a rotated corner resize in the element's local frame", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 90,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 200,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    // The rotated top-left handle is at (150, -50). In the local frame the
    // target has a 500px width and 200px height request, so width dominates
    // and the constrained result is 500x250.
    dragHandle(
      tool,
      context,
      "top-left",
      { x: 150, y: -50 },
      { x: 250, y: -350 },
      { shiftKey: true },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(-75)
    expect(result.y).toBeCloseTo(-225)
    expect(result.width).toBeCloseTo(500)
    expect(result.height).toBeCloseTo(250)
  })

  it("resizes a rotated corner around the element center when Alt is held", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 90,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 200,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const context = makeContext([rect])
    context.setSelectedIds(new Set([rect.id]))

    // The rotated top-left handle starts at (150, -50). In local space, move
    // it to (-150, -50), doubling both dimensions around the center (100, 50).
    dragHandle(
      tool,
      context,
      "top-left",
      { x: 150, y: -50 },
      { x: 200, y: -200 },
      { altKey: true },
    )

    const result = context.getElements().get(rect.id)!
    expect(result.x).toBeCloseTo(-150)
    expect(result.y).toBeCloseTo(-50)
    expect(result.width).toBeCloseTo(500)
    expect(result.height).toBeCloseTo(200)
  })
})
