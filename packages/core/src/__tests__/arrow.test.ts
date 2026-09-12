// @vitest-environment happy-dom

import { describe, expect, it } from "vitest"

import {
  resolveArrowElement,
  syncArrowBindings,
  BINDING_GAP,
} from "../bindings"
import { AdrawCanvas, createElementGroup } from "../canvas"
import {
  createArrow,
  createLine,
  createRectangle,
  getElementAtPoint,
} from "../elements"
import { createArrowTool } from "../tools/arrow"
import type { ToolContext } from "../tools/base"
import { createSelectTool } from "../tools/select"
import type {
  ArrowElement,
  CanvasElement,
  ElementId,
  Point,
  RectangleElement,
} from "../types"

function makeContext(elements: CanvasElement[] = [], zoom = 1) {
  let elementMap = new Map<ElementId, CanvasElement>(
    elements.map((el) => [el.id, el]),
  )
  let selectedIds = new Set<ElementId>()
  let historyCount = 0
  return {
    getCanvasSize: () => ({ height: 600, width: 800 }),
    getElements: () => elementMap,
    getIsSnapMode: () => false,
    getSelectedIds: () => selectedIds,
    getSnappingConfig: () => ({ threshold: 5 }),
    getStrokeColor: () => "#000",
    getViewport: () => ({ x: 0, y: 0, zoom }),
    historyCount: () => historyCount,
    pushHistory: () => {
      historyCount += 1
    },
    setActiveTool: () => {},
    setElements: (next: Map<ElementId, CanvasElement>) => {
      elementMap = next
    },
    setSelectedIds: (next: Set<ElementId>) => {
      selectedIds = next
    },
    setSnapGuides: () => {},
    setViewport: () => {},
  } satisfies ToolContext & {
    historyCount: () => number
  }
}

function pointerEvent(anchor: string | null = null): PointerEvent {
  return {
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

function makeRect(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width,
    x,
    y,
    zIndex: 0,
  })
}

function makeArrow(
  id: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  extra: Partial<ArrowElement> = {},
): ArrowElement {
  return createArrow({
    endArrowhead: true,
    endX,
    endY,
    height: Math.max(Math.abs(endY - startY), 1),
    id,
    locked: false,
    rotation: 0,
    startX,
    startY,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: Math.max(Math.abs(endX - startX), 1),
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    zIndex: 1,
    ...extra,
  })
}

// ── factory ──

describe("arrow element", () => {
  it("creates an arrow element with absolute endpoints", () => {
    const arrow = makeArrow("a1", 10, 20, 100, 200)
    expect(arrow.type).toBe("arrow")
    expect(arrow.startX).toBe(10)
    expect(arrow.startY).toBe(20)
    expect(arrow.endX).toBe(100)
    expect(arrow.endY).toBe(200)
    expect(arrow.endArrowhead).toBe(true)
  })
})

// ── arrow tool ──

describe("arrow tool", () => {
  it("shows a temporary arrow while dragging", () => {
    const tool = createArrowTool()
    const ctx = makeContext()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    expect(tool.getTemporaryElement()).toBeNull()

    tool.onPointerMove(ctx, { x: 100, y: 200 }, event)
    const temp = tool.getTemporaryElement() as ArrowElement
    expect(temp.type).toBe("arrow")
    expect(temp.startX).toBe(10)
    expect(temp.endX).toBe(100)
    expect(temp.endArrowhead).toBe(true)
  })

  it("commits the arrow, selects it and switches to select", () => {
    const tool = createArrowTool()
    const ctx = makeContext()
    const event = pointerEvent()
    let activeTool = "arrow"

    const context = {
      ...ctx,
      setActiveTool: (toolType: string) => {
        activeTool = toolType
      },
    }

    tool.onActivate(context)
    tool.onPointerDown(context, { x: 10, y: 20 }, event)
    tool.onPointerMove(context, { x: 100, y: 200 }, event)
    tool.onPointerUp(context, { x: 100, y: 200 }, event)

    const elements = context.getElements()
    expect(elements.size).toBe(1)
    const arrow = elements.values().next().value as ArrowElement
    expect(arrow.type).toBe("arrow")
    expect(context.getSelectedIds()).toEqual(new Set([arrow.id]))
    expect(activeTool).toBe("select")
  })

  it("does not commit a tiny drag", () => {
    const tool = createArrowTool()
    const ctx = makeContext()
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, event)
    tool.onPointerMove(ctx, { x: 12, y: 22 }, event)
    tool.onPointerUp(ctx, { x: 12, y: 22 }, event)

    expect(ctx.getElements().size).toBe(0)
  })

  it("binds the start and end endpoints to elements under them", () => {
    const tool = createArrowTool()
    const startRect = makeRect("start", 0, 0)
    const endRect = makeRect("end", 300, 0)
    const ctx = makeContext([startRect, endRect])
    const event = pointerEvent()

    tool.onActivate(ctx)
    // Start inside `startRect`, end inside `endRect`.
    tool.onPointerDown(ctx, { x: 50, y: 25 }, event)
    tool.onPointerMove(ctx, { x: 350, y: 25 }, event)

    const temp = tool.getTemporaryElement() as ArrowElement
    expect(temp.startBinding?.elementId).toBe("start")
    expect(temp.endBinding?.elementId).toBe("end")
    // Bound endpoints are clipped to the target borders, not left at centers.
    expect(temp.startX).toBeGreaterThan(100)
    expect(temp.endX).toBeLessThan(300)
    expect(tool.getBindingCandidate()).toBe("end")

    tool.onPointerUp(ctx, { x: 350, y: 25 }, event)
    const arrow = [...ctx.getElements().values()].find(
      (element) => element.type === "arrow",
    ) as ArrowElement
    expect(arrow.startBinding?.elementId).toBe("start")
    expect(arrow.endBinding?.elementId).toBe("end")
  })

  it("does not bind to open geometry or hidden elements", () => {
    const line = createLine({
      endX: 100,
      endY: 0,
      height: 1,
      id: "line",
      locked: false,
      rotation: 0,
      startX: 0,
      startY: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const hidden = { ...makeRect("hidden", 300, 0), visible: false }
    const tool = createArrowTool()
    const ctx = makeContext([line, hidden])
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 50, y: 0 }, event)
    tool.onPointerMove(ctx, { x: 350, y: 25 }, event)

    const temp = tool.getTemporaryElement() as ArrowElement
    expect(temp.startBinding ?? null).toBeNull()
    expect(temp.endBinding ?? null).toBeNull()
  })

  it("does not bind when dragging on empty canvas", () => {
    const tool = createArrowTool()
    const ctx = makeContext([makeRect("rect", 0, 0)])
    const event = pointerEvent()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 500, y: 500 }, event)
    tool.onPointerMove(ctx, { x: 600, y: 600 }, event)
    tool.onPointerUp(ctx, { x: 600, y: 600 }, event)

    const arrow = [...ctx.getElements().values()].find(
      (element) => element.type === "arrow",
    ) as ArrowElement
    expect(arrow.startBinding ?? null).toBeNull()
    expect(arrow.endBinding ?? null).toBeNull()
  })
})

// ── binding geometry ──

describe("arrow binding geometry", () => {
  it("clips a bound endpoint at the target border with a gap", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    const elements = new Map<ElementId, CanvasElement>([
      [rect.id, rect],
      [arrow.id, arrow],
    ])

    const resolved = resolveArrowElement(arrow, elements)
    // Rect center (150, 125), left border at x=100, gap = max(4, strokeWidth),
    // so the tip sits just outside the border.
    const gap = Math.max(BINDING_GAP, arrow.strokeWidth)
    expect(resolved.endX).toBeCloseTo(100 - gap)
    expect(resolved.endY).toBeCloseTo(125)
    expect(resolved.endBinding?.elementId).toBe("rect")
    // The free start endpoint is untouched.
    expect(resolved.startX).toBe(0)
  })

  it("clips ellipse targets at the ellipse border", () => {
    const ellipse = {
      ...makeRect("ellipse", 100, 100, 100, 50),
      type: "ellipse" as const,
    }
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "ellipse" },
    })
    const elements = new Map<ElementId, CanvasElement>([
      [ellipse.id, ellipse],
      [arrow.id, arrow],
    ])

    const resolved = resolveArrowElement(arrow, elements)
    const gap = Math.max(BINDING_GAP, arrow.strokeWidth)
    expect(resolved.endX).toBeCloseTo(100 - gap)
    expect(resolved.endY).toBeCloseTo(125)
  })

  it("follows the target when it moves", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    const elements = new Map<ElementId, CanvasElement>([
      [rect.id, rect],
      [arrow.id, arrow],
    ])

    elements.set("rect", { ...rect, x: 140 })
    syncArrowBindings(elements)
    const updated = elements.get("a1") as ArrowElement
    expect(updated.endX).toBeCloseTo(136)
    expect(updated.endBinding?.elementId).toBe("rect")
  })

  it("keeps resolving from a hidden target", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    const elements = new Map<ElementId, CanvasElement>([
      [rect.id, rect],
      [arrow.id, arrow],
    ])

    elements.set("rect", { ...rect, visible: false })
    syncArrowBindings(elements)
    const updated = elements.get("a1") as ArrowElement
    expect(updated.endBinding?.elementId).toBe("rect")
    expect(updated.endX).toBeCloseTo(96)
  })

  it("detaches and freezes coordinates when the target is deleted", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    const elements = new Map<ElementId, CanvasElement>([
      [rect.id, rect],
      [arrow.id, arrow],
    ])
    syncArrowBindings(elements)
    const boundEndX = (elements.get("a1") as ArrowElement).endX

    elements.delete("rect")
    syncArrowBindings(elements)
    const updated = elements.get("a1") as ArrowElement
    expect(updated.endBinding ?? null).toBeNull()
    expect(updated.endX).toBe(boundEndX)
  })
})

// ── select tool integration ──

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

describe("arrow selection and transform", () => {
  it("moves an arrow alone and detaches its binding", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 200, 125, {
      endBinding: { elementId: "rect" },
    })
    const tool = createSelectTool()
    const context = makeContext([rect, arrow])
    context.setSelectedIds(new Set(["a1"]))

    dragHandle(tool, context, null, { x: 50, y: 125 }, { x: 60, y: 135 })

    const updated = context.getElements().get("a1") as ArrowElement
    expect(updated.endBinding ?? null).toBeNull()
    expect(updated.endX).toBe(210)
    expect(updated.endY).toBe(135)
  })

  it("keeps the binding when the arrow moves together with its target", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    const tool = createSelectTool()
    const context = makeContext([rect, arrow])
    context.setSelectedIds(new Set(["rect", "a1"]))

    dragHandle(tool, context, null, { x: 150, y: 125 }, { x: 190, y: 165 })

    let elements = context.getElements()
    let updated = elements.get("a1") as ArrowElement
    expect(updated.endBinding?.elementId).toBe("rect")

    // The engine re-syncs bound arrows after every mutation; replay it here.
    syncArrowBindings(elements)
    elements = context.getElements()
    updated = elements.get("a1") as ArrowElement
    expect(updated.endBinding?.elementId).toBe("rect")
    // New rect center (190, 165), clipped just outside the left border (140).
    expect(updated.endX).toBeCloseTo(136)
    expect(updated.endY).toBeCloseTo(165)
  })

  it("detaches the binding when the arrow is bbox-resized alone", () => {
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    const tool = createSelectTool()
    const context = makeContext([rect, arrow])
    context.setSelectedIds(new Set(["a1"]))

    // Arrow bbox is 0,125–150,125 → drag bottom-right past the corner.
    dragHandle(
      tool,
      context,
      "bottom-right",
      { x: 150, y: 125 },
      { x: 200, y: 175 },
    )

    const updated = context.getElements().get("a1") as ArrowElement
    expect(updated.endBinding ?? null).toBeNull()
  })

  it("binds and unbinds while dragging an endpoint handle", () => {
    const rect = makeRect("rect", 300, 100)
    const arrow = makeArrow("a1", 0, 125, 200, 125)
    const tool = createSelectTool()
    const context = makeContext([rect, arrow])
    context.setSelectedIds(new Set(["a1"]))

    // Drag the end handle into the rect: binds to it.
    tool.onPointerDown(context, { x: 200, y: 125 }, pointerEvent("line-end"))
    tool.onPointerMove(context, { x: 350, y: 125 }, pointerEvent("line-end"))
    expect(tool.getBindingCandidate?.()).toBe("rect")
    let updated = context.getElements().get("a1") as ArrowElement
    expect(updated.endBinding?.elementId).toBe("rect")
    tool.onPointerUp(context, { x: 350, y: 125 }, pointerEvent(null))

    // Drag it back to empty canvas: unbinds.
    dragHandle(tool, context, "line-end", { x: 200, y: 125 }, { x: 0, y: 300 })
    updated = context.getElements().get("a1") as ArrowElement
    expect(updated.endBinding ?? null).toBeNull()
    expect(updated.endY).toBe(300)
  })
})

// ── hit testing ──

describe("arrow hit testing", () => {
  it("selects an arrow when clicking near its stroke", () => {
    const arrow = makeArrow("a1", 0, 0, 200, 0)
    const elements = new Map([[arrow.id, arrow]])
    expect(getElementAtPoint(elements, { x: 100, y: 0 })?.id).toBe("a1")
    expect(getElementAtPoint(elements, { x: 100, y: 3 })?.id).toBe("a1")
    expect(getElementAtPoint(elements, { x: 100, y: 50 })).toBeNull()
  })
})

// ── clipboard ──

describe("arrow clipboard", () => {
  function setupCanvas(): {
    canvas: AdrawCanvas
    rect: RectangleElement
    arrow: ArrowElement
  } {
    const canvas = new AdrawCanvas()
    const rect = makeRect("rect", 100, 100)
    const arrow = makeArrow("a1", 0, 125, 150, 125, {
      endBinding: { elementId: "rect" },
    })
    canvas.getElements().set(rect.id, rect)
    canvas.getElements().set(arrow.id, arrow)
    syncArrowBindings(canvas.getElements())
    return { arrow, canvas, rect }
  }

  it("remaps bindings when the target is pasted too", () => {
    const { canvas } = setupCanvas()
    canvas.selectAll()
    canvas.copy()

    const pasted = canvas.paste({ x: 500, y: 500 })
    const pastedArrow = pasted.find(
      (element) => element.type === "arrow",
    ) as ArrowElement
    const pastedRect = pasted.find(
      (element) => element.type === "rectangle",
    ) as RectangleElement

    expect(pastedArrow.endBinding?.elementId).toBe(pastedRect.id)
    expect(pastedArrow.endBinding?.elementId).not.toBe("rect")
  })

  it("drops the binding when only the arrow is copied", () => {
    const { canvas } = setupCanvas()
    canvas.setSelectedIds(new Set(["a1"]))
    canvas.copy()

    const [pasted] = canvas.paste({ x: 500, y: 500 })
    const pastedArrow = pasted as ArrowElement
    expect(pastedArrow.endBinding ?? null).toBeNull()
  })

  it("detaches arrows bound to the target on delete and keeps the coords", () => {
    const { canvas } = setupCanvas()
    canvas.setSelectedIds(new Set(["rect"]))
    canvas.deleteSelected()

    const updated = canvas.getElements().get("a1") as ArrowElement
    expect(updated.endBinding ?? null).toBeNull()
    expect(updated.endX).toBeCloseTo(96)
  })
})

// ── rendering ──

describe("arrow rendering", () => {
  it("renders the shaft plus one head per enabled endpoint", () => {
    const arrow = makeArrow("a1", 0, 0, 200, 0)
    const group = createElementGroup(arrow)
    const line = group.getElementsByTagName("line")[0]
    const heads = group.getElementsByTagName("path")

    expect(line.getAttribute("x1")).toBe("0")
    // The shaft is trimmed by the head length (max(10, 5 × strokeWidth)).
    expect(line.getAttribute("x2")).toBe("190")
    expect(heads).toHaveLength(2)
    // End head is drawn, start head is hidden.
    expect(heads[0].getAttribute("d")).toBeTruthy()
    expect(heads[1].getAttribute("display")).toBe("none")
  })

  it("draws a start head when startArrowhead is set", () => {
    const arrow = makeArrow("a1", 0, 0, 200, 0, { startArrowhead: true })
    const group = createElementGroup(arrow)
    const heads = group.getElementsByTagName("path")
    expect(heads[0].getAttribute("d")).toBeTruthy()
    expect(heads[1].getAttribute("d")).toBeTruthy()
    expect(heads[1].getAttribute("display")).toBeNull()
  })
})
