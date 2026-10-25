// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import type { TextTool } from "../tools/text"
import type { ToolType } from "../types"

function pointerEvent(): PointerEvent {
  return {
    ctrlKey: false,
    shiftKey: false,
    target: {
      getAttribute: () => null,
    },
  } as unknown as PointerEvent
}

function drag(
  canvas: AdrawCanvas,
  tool: ToolType,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.setActiveTool(tool)
  const event = pointerEvent()
  canvas.handlePointerDown(from.x, from.y, event)
  canvas.handlePointerMove(to.x, to.y, event)
  canvas.handlePointerUp(to.x, to.y, event)
}

function mount(): {
  canvas: AdrawCanvas
  svg: SVGSVGElement
} {
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
  return {
    canvas,
    svg: container.querySelector("svg")!,
  }
}

function clickCanvas(svg: SVGSVGElement, x: number, y: number): void {
  for (const type of ["pointerdown", "pointerup"] as const) {
    svg.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
      }),
    )
  }
}

describe("isToolLocked", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("is disabled by default and can be enabled with the constructor option", () => {
    expect(new AdrawCanvas().getIsToolLocked()).toBe(false)
    expect(
      new AdrawCanvas({
        isToolLocked: true,
      }).getIsToolLocked(),
    ).toBe(true)
  })

  it("switches back to the selection tool by default", () => {
    const canvas = new AdrawCanvas()

    drag(canvas, "rectangle", { x: 10, y: 10 }, { x: 90, y: 80 })

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds().size).toBe(1)
  })

  it.each([
    "rectangle",
    "ellipse",
    "diamond",
    "line",
    "arrow",
    "note",
  ] as const)("keeps the %s tool active after creating an element", (tool) => {
    const canvas = new AdrawCanvas({ isToolLocked: true })

    drag(canvas, tool, { x: 10, y: 10 }, { x: 90, y: 80 })

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getActiveTool()).toBe(tool)
    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("keeps the text tool active after committing text", () => {
    const canvas = new AdrawCanvas({ isToolLocked: true })
    canvas.setActiveTool("text")

    const tool = canvas.getActiveToolInstance() as TextTool
    const context = canvas.getToolContext()
    const event = pointerEvent()
    tool.onPointerDown(context, { x: 40, y: 40 }, event)
    tool.setText("Hello")
    tool.onPointerUp(context, { x: 40, y: 40 }, event)

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getActiveTool()).toBe("text")
    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("can be toggled at runtime", () => {
    const canvas = new AdrawCanvas()

    canvas.setIsToolLocked(true)
    drag(canvas, "ellipse", { x: 10, y: 10 }, { x: 60, y: 60 })
    expect(canvas.getActiveTool()).toBe("ellipse")
    expect(canvas.getSelectedIds().size).toBe(0)

    canvas.setIsToolLocked(false)
    drag(canvas, "rectangle", { x: 80, y: 80 }, { x: 130, y: 130 })
    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds().size).toBe(1)
  })

  it("keeps the text tool active while editing text and after committing", () => {
    const { canvas, svg } = mount()
    canvas.setIsToolLocked(true)
    canvas.setActiveTool("text")

    clickCanvas(svg, 300, 300)

    expect(canvas.getActiveTool()).toBe("text")
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()

    editor!.value = "Hello"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    expect(canvas.getElements().size).toBe(1)
    expect(canvas.getActiveTool()).toBe("text")
  })
})
