// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { STROKE_WIDTH, TEXT_FONT_SIZE } from "../constants"
import {
  createPath,
  createRectangle,
  createText,
  DEFAULT_PATH_SMOOTHING,
} from "../elements"
import { inferConfigurableTool } from "../tool-options"
import type {
  CanvasElement,
  PathElement,
  RectangleElement,
  TextElement,
} from "../types"

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
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.handlePointerDown(from.x, from.y, pointerEvent())
  canvas.handlePointerMove(to.x, to.y, pointerEvent())
  canvas.handlePointerUp(to.x, to.y, pointerEvent())
}

function findElement<T extends CanvasElement["type"]>(
  canvas: AdrawCanvas,
  type: T,
): Extract<CanvasElement, { type: T }> {
  const element = [...canvas.getElements().values()].find(
    (candidate) => candidate.type === type,
  )
  if (!element) {
    throw new Error(`No ${type} element found`)
  }
  return element as Extract<CanvasElement, { type: T }>
}

describe("tool options", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("infers the style tool from a homogeneous selection", () => {
    const rectangle = createRectangle({
      cornerRadius: 0,
      height: 10,
      id: "rect",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 10,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const path = createPath({
      height: 10,
      id: "path",
      locked: false,
      points: [],
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 10,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const elements = new Map([
      [rectangle.id, rectangle],
      [path.id, path],
    ])

    expect(
      inferConfigurableTool("select", elements, new Set([rectangle.id])),
    ).toBe("rectangle")
    expect(
      inferConfigurableTool(
        "select",
        elements,
        new Set([rectangle.id, path.id]),
      ),
    ).toBeNull()
    expect(inferConfigurableTool("draw", elements, new Set())).toBe("draw")
    expect(inferConfigurableTool("select", elements, new Set())).toBeNull()
  })

  it("resolves defaults for every configurable tool", () => {
    const canvas = new AdrawCanvas()

    expect(canvas.getToolOptions("draw")).toMatchObject({
      smoothing: DEFAULT_PATH_SMOOTHING,
      strokeWidth: STROKE_WIDTH,
    })
    expect(canvas.getToolOptions("rectangle").cornerRadius).toBe(0)
    expect(canvas.getToolOptions("text").fontSize).toBe(TEXT_FONT_SIZE)
  })

  it("applies constructor options to newly drawn elements", () => {
    const canvas = new AdrawCanvas({
      tools: {
        draw: { smoothing: 0.8, strokeWidth: 7 },
        rectangle: {
          cornerRadius: 12,
          strokeColor: "#123456",
          strokeWidth: 5,
        },
      },
    })

    canvas.setActiveTool("rectangle")
    drag(canvas, { x: 10, y: 10 }, { x: 110, y: 110 })
    const rectangle = findElement(canvas, "rectangle")
    expect(rectangle.cornerRadius).toBe(12)
    expect(rectangle.strokeColor).toBe("#123456")
    expect(rectangle.strokeWidth).toBe(5)

    canvas.setActiveTool("draw")
    drag(canvas, { x: 20, y: 20 }, { x: 120, y: 60 })
    const path = findElement(canvas, "path")
    expect(path.smoothing).toBe(0.8)
    expect(path.strokeWidth).toBe(7)
  })

  it("applies setToolOptions to future elements", () => {
    const canvas = new AdrawCanvas()
    canvas.setToolOptions("line", {
      strokeColor: "#abcdef",
      strokeWidth: 6,
    })

    canvas.setActiveTool("line")
    drag(canvas, { x: 10, y: 10 }, { x: 110, y: 60 })

    const line = findElement(canvas, "line")
    expect(line.strokeColor).toBe("#abcdef")
    expect(line.strokeWidth).toBe(6)
  })

  it("restyles matching elements in the current selection", () => {
    const rectangle = createRectangle({
      cornerRadius: 0,
      height: 50,
      id: "rect",
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
    const canvas = new AdrawCanvas()
    canvas.addElement(rectangle)
    canvas.selectAll()

    canvas.setToolOptions("rectangle", {
      cornerRadius: 6,
      strokeColor: "#f00",
      strokeWidth: 4,
    })

    const updated = canvas.getElements().get("rect") as RectangleElement
    expect(updated.cornerRadius).toBe(6)
    expect(updated.strokeColor).toBe("#f00")
    expect(updated.strokeWidth).toBe(4)
  })

  it("recomputes text bounds when fontSize changes", () => {
    const text = createText({
      fontSize: 20,
      height: 24,
      id: "text",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      text: "Hello",
      visible: true,
      width: 60,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const canvas = new AdrawCanvas()
    canvas.addElement(text)
    canvas.selectAll()

    canvas.setToolOptions("text", { fontSize: 40 })

    const updated = canvas.getElements().get("text") as TextElement
    expect(updated.fontSize).toBe(40)
    expect(updated.width).toBe(120)
    expect(updated.height).toBe(48)
  })

  it("applies smoothing to selected paths", () => {
    const canvas = new AdrawCanvas({
      tools: { draw: { smoothing: 0.5 } },
    })
    canvas.setActiveTool("draw")
    drag(canvas, { x: 10, y: 10 }, { x: 100, y: 40 })

    const path = findElement(canvas, "path") as PathElement
    canvas.selectAll()
    canvas.setToolOptions("draw", { smoothing: 0.9 })

    expect((canvas.getElements().get(path.id) as PathElement).smoothing).toBe(
      0.9,
    )
  })

  it("lets setStrokeColor override per-tool colors", () => {
    const canvas = new AdrawCanvas({
      tools: { rectangle: { strokeColor: "#111" } },
    })
    expect(canvas.getToolOptions("rectangle").strokeColor).toBe("#111")

    canvas.setStrokeColor("#222")

    expect(canvas.getToolOptions("rectangle").strokeColor).toBe("#222")
  })

  it("emits resolved options on toolOptionsChange", () => {
    const canvas = new AdrawCanvas()
    const events: {
      tool: string
      options: Record<string, unknown>
    }[] = []
    canvas.on("toolOptionsChange", (event) => {
      events.push(event as { tool: string; options: Record<string, unknown> })
    })

    canvas.setToolOptions("text", { fontSize: 30 })

    expect(events.at(-1)).toMatchObject({
      options: { fontSize: 30 },
      tool: "text",
    })
  })

  it("updates rendered stroke width and corner radius", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    )
    const container = document.createElement("div")
    document.body.appendChild(container)
    const canvas = new AdrawCanvas({
      container,
      tools: { rectangle: { cornerRadius: 9, strokeWidth: 6 } },
    })
    canvas.setCanvasSize(800, 600)

    canvas.setActiveTool("rectangle")
    const start = { x: 200, y: 200 }
    const end = { x: 400, y: 400 }
    const svg = container.querySelector("svg")!
    for (const [type, point] of [
      ["pointerdown", start],
      ["pointermove", end],
      ["pointerup", end],
    ] as const) {
      svg.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: point.x,
          clientY: point.y,
          pointerId: 1,
        }),
      )
    }

    const rectangle = findElement(canvas, "rectangle")
    const node = container.querySelector(
      `[id="${rectangle.id}"] rect`,
    ) as SVGRectElement
    expect(node.getAttribute("rx")).toBe("9")
    expect(node.getAttribute("stroke-width")).toBe("6")

    canvas.setToolOptions("rectangle", { cornerRadius: 3, strokeWidth: 2 })

    expect(node.getAttribute("rx")).toBe("3")
    expect(node.getAttribute("stroke-width")).toBe("2")
  })

  it("uses the text tool font size for the inline editor preview", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    )
    const container = document.createElement("div")
    document.body.appendChild(container)
    const canvas = new AdrawCanvas({
      container,
      tools: { text: { fontSize: 36 } },
    })
    canvas.setCanvasSize(800, 600)
    canvas.setActiveTool("text")

    const svg = container.querySelector("svg")!
    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 400,
        clientY: 300,
        pointerId: 1,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(editor!.style.fontSize).toBe("36px")

    canvas.destroy()
  })
})
