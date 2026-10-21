import { beforeEach, describe, expect, it, vi } from "vitest"

import { TEXT_LINE_HEIGHT } from "../constants"
import { createText, getElementAtPoint, measureTextSize } from "../elements"
import { createSelectTool } from "../tools/select"
import { createTextTool } from "../tools/text"
import type { CanvasElement, ElementId, TextElement } from "../types"

function makeContext(elements: CanvasElement[] = []) {
  let elementMap = new Map<ElementId, CanvasElement>(
    elements.map((el) => [el.id, el]),
  )
  let selectedIds = new Set<ElementId>()
  let historyCount = 0
  const setActiveTool = vi.fn()
  return {
    getCanvasSize: () => ({ height: 600, width: 800 }),
    getElements: () => elementMap,
    getIsSnapMode: () => false,
    getSelectedIds: () => selectedIds,
    getSnappingConfig: () => ({ threshold: 5 }),
    getStrokeColor: () => "#000",
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    historyCount: () => historyCount,
    pushHistory: () => {
      historyCount += 1
    },
    setActiveTool,
    setElements: (next: Map<ElementId, CanvasElement>) => {
      elementMap = next
    },
    setSelectedIds: (next: Set<ElementId>) => {
      selectedIds = next
    },
    setSnapGuides: () => {},
    setViewport: () => {},
  }
}

function pointerEvent(anchor: string | null = null): PointerEvent {
  return {
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

function makeText(
  id: string,
  overrides: Partial<TextElement> = {},
): TextElement {
  return createText({
    fontSize: 20,
    height: 24,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    text: "Hello",
    visible: true,
    width: 60,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

// ── measureTextSize ──

describe("measureTextSize", () => {
  it("measures a single line at ~0.6em per character", () => {
    const size = measureTextSize("Hello", 20)

    expect(size.width).toBe(20 * 5 * 0.6)
    expect(size.height).toBe(20 * TEXT_LINE_HEIGHT)
  })

  it("uses the longest line for the width", () => {
    const size = measureTextSize("a\nlonger line", 10)

    expect(size.width).toBe(10 * "longer line".length * 0.6)
    expect(size.height).toBe(2 * 10 * TEXT_LINE_HEIGHT)
  })

  it("never returns a zero size", () => {
    const size = measureTextSize("", 20)

    expect(size.width).toBeGreaterThanOrEqual(1)
    expect(size.height).toBeGreaterThanOrEqual(1)
  })
})

// ── text factory ──

describe("text element", () => {
  it("factory assigns type and generated id", () => {
    const text = makeText("t1")

    expect(text.type).toBe("text")
    expect(text.text).toBe("Hello")
    expect(text.fontSize).toBe(20)
  })

  it("hit-tests inside its bounding box", () => {
    const text = makeText("t1", { height: 24, width: 60 })
    const elements = new Map([[text.id, text]])

    expect(getElementAtPoint(elements, { x: 30, y: 12 })?.id).toBe("t1")
    expect(getElementAtPoint(elements, { x: 61, y: 12 })).toBeNull()
    expect(getElementAtPoint(elements, { x: 30, y: 25 })).toBeNull()
  })
})

// ── text tool ──

describe("text tool", () => {
  it("creates a temporary text element on pointer down", () => {
    const tool = createTextTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())

    const temp = tool.getTemporaryElement() as TextElement | null
    expect(temp).not.toBeNull()
    expect(temp!.type).toBe("text")
    expect(temp!.x).toBe(10)
    expect(temp!.y).toBe(20)
    expect(temp!.fontSize).toBe(20)
  })

  it("updates the temporary element via setText", () => {
    const tool = createTextTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 0, y: 0 }, pointerEvent())
    tool.setText("Hi there")

    const temp = tool.getTemporaryElement() as TextElement
    expect(temp.text).toBe("Hi there")
    expect(temp.width).toBe(measureTextSize("Hi there", 20).width)
    expect(temp.height).toBe(measureTextSize("Hi there", 20).height)
  })

  it("commits a text element on pointer up when text is non-empty", () => {
    const tool = createTextTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 10, y: 20 }, pointerEvent())
    tool.setText("Hello")
    tool.onPointerUp(ctx, { x: 10, y: 20 }, pointerEvent())

    const elements = ctx.getElements()
    expect(elements.size).toBe(1)

    const text = elements.values().next().value as TextElement
    expect(text.type).toBe("text")
    expect(text.text).toBe("Hello")
    expect(text.x).toBe(10)
    expect(text.y).toBe(20)
    expect(ctx.getSelectedIds().has(text.id)).toBe(true)
    expect(ctx.historyCount()).toBe(1)
    expect(ctx.setActiveTool).toHaveBeenCalledWith("select")
  })

  it("does not commit empty text and stays on the text tool", () => {
    const tool = createTextTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 0, y: 0 }, pointerEvent())
    tool.onPointerUp(ctx, { x: 0, y: 0 }, pointerEvent())

    expect(ctx.getElements().size).toBe(0)
    expect(ctx.setActiveTool).not.toHaveBeenCalled()
  })

  it("clears temporary element and pending text on deactivate", () => {
    const tool = createTextTool()
    const ctx = makeContext()

    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 0, y: 0 }, pointerEvent())
    tool.setText("Hello")
    expect(tool.getTemporaryElement()).not.toBeNull()

    tool.onDeactivate(ctx)
    expect(tool.getTemporaryElement()).toBeNull()

    // A fresh gesture after reactivation starts empty.
    tool.onActivate(ctx)
    tool.onPointerDown(ctx, { x: 0, y: 0 }, pointerEvent())
    tool.onPointerUp(ctx, { x: 0, y: 0 }, pointerEvent())
    expect(ctx.getElements().size).toBe(0)
  })
})

// ── text selection & transform ──

describe("text selection and transform", () => {
  let tool: ReturnType<typeof createSelectTool>

  beforeEach(() => {
    tool = createSelectTool()
  })

  it("selects a text element by clicking inside its bounds", () => {
    const text = makeText("t1", { height: 24, width: 60 })
    const context = makeContext([text])

    tool.onPointerDown(context, { x: 30, y: 12 }, pointerEvent())

    expect(context.getSelectedIds().has(text.id)).toBe(true)
  })

  it("moves a text element", () => {
    const text = makeText("t1", { height: 24, width: 60 })
    const context = makeContext([text])
    context.setSelectedIds(new Set([text.id]))

    tool.onPointerDown(context, { x: 30, y: 12 }, pointerEvent())
    tool.onPointerMove(context, { x: 60, y: 42 }, pointerEvent())
    tool.onPointerUp(context, { x: 60, y: 42 }, pointerEvent())

    const result = context.getElements().get(text.id) as TextElement
    expect(result.x).toBe(30)
    expect(result.y).toBe(30)
  })

  it("switches to fixed width and wraps when dragging a side handle", () => {
    const text = makeText("t1", {
      height: 25,
      text: "hello world",
      width: 120,
    })
    const context = makeContext([text])
    context.setSelectedIds(new Set([text.id]))

    tool.onPointerDown(
      context,
      { x: 120, y: 12.5 },
      pointerEvent("right-center"),
    )
    tool.onPointerMove(
      context,
      { x: 66, y: 12.5 },
      pointerEvent("right-center"),
    )
    tool.onPointerUp(context, { x: 66, y: 12.5 }, pointerEvent(null))

    const result = context.getElements().get(text.id) as TextElement
    expect(result.autoSize).toBe(false)
    expect(result.width).toBeCloseTo(66)
    expect(result.height).toBeCloseTo(2 * 20 * TEXT_LINE_HEIGHT)
  })

  it("scales the font size when dragging a corner handle", () => {
    const text = makeText("t1", { height: 25, width: 60 })
    const context = makeContext([text])
    context.setSelectedIds(new Set([text.id]))

    tool.onPointerDown(context, { x: 60, y: 25 }, pointerEvent("bottom-right"))
    tool.onPointerMove(context, { x: 120, y: 50 }, pointerEvent("bottom-right"))
    tool.onPointerUp(context, { x: 120, y: 50 }, pointerEvent(null))

    const result = context.getElements().get(text.id) as TextElement
    expect(result.fontSize).toBe(40)
    expect(result.width).toBeCloseTo(120)
    expect(result.height).toBeCloseTo(40 * TEXT_LINE_HEIGHT)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
  })
})

describe("text tool fixed-width gesture", () => {
  it("exposes a preview and commits an empty fixed-width element", () => {
    const tool = createTextTool()
    const context = makeContext()

    tool.onActivate(context)
    tool.onPointerDown(context, { x: 10, y: 20 }, pointerEvent())
    tool.setFixedWidth(80, 10)

    const temporary = tool.getTemporaryElement() as TextElement
    expect(temporary.autoSize).toBe(false)
    expect(temporary.width).toBe(80)
    expect(temporary.height).toBe(20 * TEXT_LINE_HEIGHT)
    expect(tool.getSelectionBox?.()).toMatchObject({
      height: 20 * TEXT_LINE_HEIGHT,
      width: 80,
      x: 10,
      y: 20,
    })

    tool.onPointerUp(context, { x: 90, y: 20 }, pointerEvent())

    const element = context.getElements().values().next().value as TextElement
    expect(element.autoSize).toBe(false)
    expect(element.width).toBe(80)
    expect(element.height).toBe(20 * TEXT_LINE_HEIGHT)
    expect(element.text).toBe("")
    expect(element.x).toBe(10)
    expect(context.historyCount()).toBe(1)
    expect(context.setActiveTool).toHaveBeenCalledWith("select")
  })
})
