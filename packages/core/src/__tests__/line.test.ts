import { beforeEach, describe, expect, it } from "vitest"

import { createLine, createRectangle, getElementAtPoint } from "../elements"
import type { ToolContext } from "../tools/base"
import { createLineTool } from "../tools/line"
import { createSelectTool } from "../tools/select"
import type { CanvasElement, ElementId, LineElement, Point } from "../types"

function makeContext(elements: CanvasElement[] = []) {
  let elementMap = new Map<ElementId, CanvasElement>(
    elements.map((el) => [el.id, el]),
  )
  let selectedIds = new Set<ElementId>()
  let historyCount = 0
  return {
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
    setElements: (next: any) => {
      elementMap = next
    },
    setSelectedIds: (next: any) => {
      selectedIds = next
    },
    setViewport: () => {},
  }
}

function pointerEvent(anchor: string | null = null): PointerEvent {
  return {
    ctrlKey: false,
    shiftKey: false,
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

function dragHandle(
  tool: ReturnType<typeof createSelectTool>,
  context: ToolContext,
  anchor: string | null,
  from: Point,
  to: Point,
) {
  tool.onPointerDown(context, from, pointerEvent(anchor))
  tool.onPointerMove(context, to, pointerEvent(anchor))
  tool.onPointerUp(context, to, pointerEvent(null))
}

function makeLine(
  id: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): LineElement {
  return createLine({
    endX,
    endY,
    height: Math.abs(endY - startY) || 1,
    id,
    locked: false,
    rotation: 0,
    startX,
    startY,
    strokeColor: "#000",
    strokeWidth: 4,
    visible: true,
    width: Math.abs(endX - startX) || 1,
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    zIndex: 0,
  })
}

// ── line tool creation ──

describe("line tool", () => {
  it("creates a temporary line on pointer move", () => {
    const tool = createLineTool()
    const ctx = makeContext()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)

    let temp = tool.getTemporaryElement() as LineElement | null
    expect(temp).toBeNull()

    tool.onPointerMove(ctx, { x: 100, y: 200 }, event)

    temp = tool.getTemporaryElement() as LineElement | null
    expect(temp).not.toBeNull()
    expect(temp!.type).toBe("line")
    expect(temp!.startX).toBe(10)
    expect(temp!.startY).toBe(20)
    expect(temp!.endX).toBe(100)
    expect(temp!.endY).toBe(200)
  })

  it("commits a line on pointer up when drag is large enough", () => {
    const tool = createLineTool()
    const ctx = makeContext()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    tool.onPointerMove(ctx, { x: 100, y: 200 }, event)
    tool.onPointerUp(ctx, { x: 100, y: 200 }, event)

    const elements = ctx.getElements()
    expect(elements.size).toBe(1)

    const line = elements.values().next().value as LineElement
    expect(line.type).toBe("line")
    expect(line.startX).toBe(10)
    expect(line.startY).toBe(20)
    expect(line.endY).toBe(200)
    expect(line.endX).toBe(100)
  })

  it("does not commit a line when the drag is too small", () => {
    const ctx = makeContext()
    const tool = createLineTool()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    tool.onPointerMove(ctx, { x: 12, y: 22 }, event)
    tool.onPointerUp(ctx, { x: 12, y: 22 }, event)

    expect(ctx.getElements().size).toBe(0)
  })

  it("clears temporary element on deactivate", () => {
    const tool = createLineTool()
    const ctx = makeContext()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 0, y: 0 }, event)
    tool.onPointerMove(ctx, { x: 50, y: 50 }, event)
    expect(tool.getTemporaryElement()).not.toBeNull()

    tool.onDeactivate(ctx)
    expect(tool.getTemporaryElement()).toBeNull()
  })

  it("clears state on pointer up", () => {
    const ctx = makeContext()
    const tool = createLineTool()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    tool.onPointerMove(ctx, { x: 100, y: 200 }, event)
    tool.onPointerUp(ctx, { x: 100, y: 200 }, event)

    expect(tool.getTemporaryElement()).toBeNull()
  })

  it("updates bbox x/y/width/height from drag start/end", () => {
    const tool = createLineTool()
    const ctx = makeContext()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 100, y: 200 }, event)
    tool.onPointerMove(ctx, { x: 10, y: 20 }, event)

    const temp = tool.getTemporaryElement() as LineElement
    expect(temp.x).toBe(10)
    expect(temp.y).toBe(20)
    expect(temp.width).toBe(90)
    expect(temp.height).toBe(180)
  })

  it("factory creates a line element with correct fields", () => {
    const line = createLine({
      endX: 100,
      endY: 200,
      height: 100,
      locked: false,
      rotation: 0,
      startX: 10,
      startY: 20,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 10,
      y: 20,
      zIndex: 0,
    })

    expect(line.type).toBe("line")
    expect(line.id).toBeTruthy()
    expect(line.startX).toBe(10)
    expect(line.startY).toBe(20)
    expect(line.endX).toBe(100)
    expect(line.endY).toBe(200)
  })
})

// ── Line hit testing ──

describe("line hit testing", () => {
  it("selects a line when clicking near its stroke", () => {
    const line = makeLine("a", 0, 0, 200, 0)
    const elements = new Map([[line.id, line]])
    expect(getElementAtPoint(elements, { x: 100, y: 0 })?.id).toBe("a")
    expect(getElementAtPoint(elements, { x: 100, y: 3 })?.id).toBe("a")
  })

  it("misses a line when clicking far from the stroke but inside its bounding box", () => {
    const line = makeLine("a", 0, 0, 200, 0)
    const elements = new Map([[line.id, line]])
    expect(getElementAtPoint(elements, { x: 100, y: 50 })).toBeNull()
  })

  it("hits a diagonal line near the stroke", () => {
    const line = makeLine("a", 0, 0, 100, 100)
    const elements = new Map([[line.id, line]])
    const hit = getElementAtPoint(elements, { x: 51, y: 51 })
    expect(hit?.id).toBe("a")
  })
})

// ── Line selection & transform ──

describe("line selection and transform", () => {
  let tool: ReturnType<typeof createSelectTool>
  let line: LineElement

  beforeEach(() => {
    tool = createSelectTool()
    line = makeLine("l1", 0, 0, 200, 100)
  })

  it("selects a line by clicking near its stroke", () => {
    const context = makeContext([line])
    tool.onPointerDown(context, { x: 100, y: 50 }, pointerEvent(null))
    expect(context.getSelectedIds().has(line.id)).toBe(true)
  })

  it("does not select a line when clicking inside the bbox but off the stroke", () => {
    const context = makeContext([line])
    // The line runs from (0,0) to (100,100) but its bbox covers
    // x: [0,100], y: [0,100].  Click far from the line path.
    tool.onPointerDown(context, { x: 10, y: 90 }, pointerEvent(null))
    expect(context.getSelectedIds().size).toBe(0)
  })

  it("moves a line translating its endpoints", () => {
    // Line is (0, 0)→(200, 100) from beforeEach
    const context = makeContext([line])
    context.setSelectedIds(new Set([line.id]))

    // Click on the line at (100, 50) and drag to (130, 70) → delta (30, 20)
    dragHandle(tool, context, null, { x: 100, y: 50 }, { x: 130, y: 70 })

    const result = context.getElements().get(line.id) as LineElement
    expect(result.startX).toBe(30)
    expect(result.startY).toBe(20)
    expect(result.endX).toBe(230)
    expect(result.endY).toBe(120)
  })

  it("drags line-start endpoint handle", () => {
    // Line is (0, 0)→(200, 100) from beforeEach
    const context = makeContext([line])
    context.setSelectedIds(new Set([line.id]))

    dragHandle(tool, context, "line-start", { x: 0, y: 0 }, { x: -50, y: -50 })

    const result = context.getElements().get(line.id) as LineElement
    expect(result.startX).toBe(-50)
    expect(result.startY).toBe(-50)
    // Endpoint unchanged
    expect(result.endX).toBe(200)
    expect(result.endY).toBe(100)
    // Bbox recomputed: min(-50, 200) = -50, max(0, 200) → width=250
    expect(result.x).toBe(-50)
    expect(result.y).toBe(-50)
    expect(result.width).toBe(250)
    expect(result.height).toBe(150)
  })

  it("drag line-end endpoint handle", () => {
    const context = makeContext([line])
    context.setSelectedIds(new Set([line.id]))

    dragHandle(tool, context, "line-end", { x: 100, y: 100 }, { x: 200, y: 50 })

    const result = context.getElements().get(line.id) as LineElement
    expect(result.endX).toBe(200)
    expect(result.endY).toBe(50)
    expect(result.startX).toBe(0)
    expect(result.startY).toBe(0)
  })
})

// ── Line rotation ──

describe("line rotation", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("rotates a single line's endpoints in place and keeps rotation=0", () => {
    // Line from (0, 0) to (100, 100) — bbox center at (50, 50)
    const line = makeLine("l1", 0, 0, 100, 100)
    const context = makeContext([line])
    context.setSelectedIds(new Set([line.id]))

    // Rotate 90° about bbox center (50, 50).
    // start (0, 0) → dx=-50, dy=-50 → (50 + 50, 50 - 50) = (100, 0)
    // end (100, 100) → dx=50, dy=50 → (50 - 50, 50 + 50) = (0, 100)
    dragHandle(tool, context, "rotation", { x: 50, y: -50 }, { x: 150, y: 50 })

    const result = context.getElements().get(line.id) as LineElement
    expect(result.rotation).toBe(0)
    // cos(π/2) ≈ 0, sin(π/2) = 1, so the results should be exact. Use
    // toBeCloseTo with numDigits=1 to tolerate tiny floating-point noise.
    expect(result.startX).toBeCloseTo(100)
    expect(result.startY).toBeCloseTo(0)
    expect(result.endX).toBeCloseTo(0)
    expect(result.endY).toBeCloseTo(100)
  })

  it("rotates a line along with other elements, orbiting endpoints", () => {
    // Both elements share the same y-span so selection center is clean.
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      id: "r1",
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
    // Line from (200, 0) to (300, 100) — bbox matches rect's y-span.
    const line = makeLine("l1", 200, 0, 300, 100)
    const context = makeContext([rect, line])
    context.setSelectedIds(new Set([rect.id, line.id]))

    // Selection bounds: x=0, y=0, width=300, height=100 → center (150, 50).
    // Drag rotation handle from (150, -50) to (250, 50): deltaAngle = 90°.
    // (200, 0) about (150, 50): dx=50, dy=-50 → (150 + 50, 50 + 50) = (200, 100)
    // (300, 100) about (150, 50): dx=150, dy=50 → (150 - 50, 50 + 150) = (100, 200)
    dragHandle(tool, context, "rotation", { x: 150, y: -50 }, { x: 250, y: 50 })

    const resultLine = context.getElements().get(line.id) as LineElement
    expect(resultLine.rotation).toBe(0)
    expect(resultLine.startX).toBeCloseTo(200)
    expect(resultLine.startY).toBeCloseTo(100)
    expect(resultLine.endX).toBeCloseTo(100)
    expect(resultLine.endY).toBeCloseTo(200)
  })
})

// ── Line resize in multi-selection ──

describe("line multi-element resize", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("scales a line's endpoints during multi-selection resize", () => {
    // Both elements share the same bbox so scale matches exactly.
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      id: "r1",
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
    // Diagonal line from corner to corner — bbox matches rect exactly.
    const line = makeLine("l1", 0, 0, 100, 100)
    const context = makeContext([rect, line])
    context.setSelectedIds(new Set([rect.id, line.id]))

    // Selection bounds: x=0, y=0, width=100, height=100.
    // Drag bottom-right handle from (100, 100) to (200, 200):
    //   scaleX = 200/100 = 2, scaleY = 200/100 = 2, anchor is top-left (0, 0)
    dragHandle(
      tool,
      context,
      "bottom-right",
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    )

    const resultLine = context.getElements().get(line.id) as LineElement
    expect(resultLine.startX).toBeCloseTo(0)
    expect(resultLine.startY).toBeCloseTo(0)
    expect(resultLine.endX).toBeCloseTo(200)
    expect(resultLine.endY).toBeCloseTo(200)
  })
})
