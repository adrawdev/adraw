// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import {
  STROKE_COLOR,
  STROKE_WIDTH,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
} from "../constants"
import { createPath, createRectangle, createText } from "../elements"
import type { CanvasElement, PathElement, TextElement } from "../types"

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

describe("style", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("applies setStyle to future elements of every tool", () => {
    const canvas = new AdrawCanvas()
    canvas.setStyle({
      cornerRadius: 9,
      fillColor: "#abcdef",
      fontSize: 21,
      opacity: 0.5,
      strokeColor: "#123456",
      strokeWidth: 6,
    })

    canvas.setActiveTool("rectangle")
    drag(canvas, { x: 10, y: 10 }, { x: 110, y: 110 })
    expect(findElement(canvas, "rectangle")).toMatchObject({
      cornerRadius: 9,
      fillColor: "#abcdef",
      opacity: 0.5,
      strokeColor: "#123456",
      strokeWidth: 6,
    })

    canvas.setActiveTool("ellipse")
    drag(canvas, { x: 20, y: 20 }, { x: 120, y: 80 })
    expect(findElement(canvas, "ellipse")).toMatchObject({
      fillColor: "#abcdef",
      opacity: 0.5,
      strokeColor: "#123456",
      strokeWidth: 6,
    })

    canvas.setActiveTool("line")
    drag(canvas, { x: 30, y: 30 }, { x: 130, y: 90 })
    expect(findElement(canvas, "line")).toMatchObject({
      opacity: 0.5,
      strokeColor: "#123456",
      strokeWidth: 6,
    })

    canvas.setActiveTool("arrow")
    drag(canvas, { x: 40, y: 40 }, { x: 140, y: 100 })
    expect(findElement(canvas, "arrow")).toMatchObject({
      opacity: 0.5,
      strokeColor: "#123456",
      strokeWidth: 6,
    })

    canvas.setActiveTool("draw")
    drag(canvas, { x: 50, y: 50 }, { x: 150, y: 110 })
    const path = findElement(canvas, "path")
    expect(path).toMatchObject({
      opacity: 0.5,
      strokeColor: "#123456",
      strokeWidth: 6,
    })
    expect("fillColor" in path).toBe(false)

    canvas.setActiveTool("note")
    canvas.handlePointerDown(0, 0, pointerEvent())
    canvas.handlePointerUp(0, 0, pointerEvent())
    expect(findElement(canvas, "note")).toMatchObject({
      cornerRadius: 9,
      fillColor: "#abcdef",
      fontSize: 21,
      opacity: 0.5,
      strokeColor: "#123456",
    })
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
    const path = createPath({
      height: 40,
      id: "path",
      locked: false,
      points: [],
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 80,
      x: 0,
      y: 60,
      zIndex: 0,
    })
    const text = createText({
      fontSize: 20,
      height: 25,
      id: "text",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      text: "Hello",
      visible: true,
      width: 60,
      x: 0,
      y: 120,
      zIndex: 0,
    })
    const canvas = new AdrawCanvas()
    canvas.addElement([rectangle, path, text])
    canvas.selectAll()

    canvas.setStyle({
      fillColor: "#abcdef",
      fontSize: 36,
      opacity: 0.4,
      strokeColor: "#f00",
      strokeWidth: 4,
    })

    expect(canvas.getElements().get("rect")).toMatchObject({
      fillColor: "#abcdef",
      opacity: 0.4,
      strokeColor: "#f00",
      strokeWidth: 4,
    })
    expect(canvas.getElements().get("path")).toMatchObject({
      opacity: 0.4,
      strokeColor: "#f00",
      strokeWidth: 4,
    })
    expect("fillColor" in canvas.getElements().get("path")!).toBe(false)
    expect(canvas.getElements().get("text")).toMatchObject({
      fontSize: 36,
      opacity: 0.4,
      strokeColor: "#f00",
    })
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

    canvas.setStyle({ fontSize: 40 })

    const updated = canvas.getElements().get("text") as TextElement
    expect(updated.fontSize).toBe(40)
    expect(updated.width).toBe(120)
    expect(updated.height).toBe(40 * TEXT_LINE_HEIGHT)
  })

  it("restyles text font family, alignment and line height", () => {
    const text = createText({
      fontSize: 20,
      height: 25,
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

    canvas.setStyle({
      fontFamily: "monospace",
      lineHeight: 2,
      textAlign: "center",
    })

    const updated = canvas.getElements().get("text") as TextElement
    expect(updated.fontFamily).toBe("monospace")
    expect(updated.lineHeight).toBe(2)
    expect(updated.textAlign).toBe("center")
    expect(updated.height).toBe(40)
  })

  it("applies smoothing to selected paths", () => {
    const canvas = new AdrawCanvas()
    canvas.setActiveTool("draw")
    drag(canvas, { x: 10, y: 10 }, { x: 100, y: 40 })

    const path = findElement(canvas, "path") as PathElement
    canvas.selectAll()
    canvas.setStyle({ smoothing: 0.9 })

    expect((canvas.getElements().get(path.id) as PathElement).smoothing).toBe(
      0.9,
    )
  })

  it("applies fill and opacity to ellipses", () => {
    const canvas = new AdrawCanvas()
    canvas.setStyle({ fillColor: "#d0bfff", opacity: 0.5, strokeWidth: 3 })

    canvas.setActiveTool("ellipse")
    drag(canvas, { x: 10, y: 10 }, { x: 110, y: 60 })

    const ellipse = findElement(canvas, "ellipse")
    expect(ellipse.fillColor).toBe("#d0bfff")
    expect(ellipse.opacity).toBe(0.5)
    expect(ellipse.strokeWidth).toBe(3)

    canvas.selectAll()
    canvas.setStyle({ fillColor: "#ffd8a8", opacity: 0.2 })

    const updated = findElement(canvas, "ellipse")
    expect(updated.fillColor).toBe("#ffd8a8")
    expect(updated.opacity).toBe(0.2)
  })

  it("gets the style of the selected elements", () => {
    const rectangle = createRectangle({
      cornerRadius: 6,
      fillColor: "#abcdef",
      height: 50,
      id: "rect",
      locked: false,
      opacity: 0.4,
      rotation: 0,
      strokeColor: "#f00",
      strokeWidth: 4,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const canvas = new AdrawCanvas()
    canvas.addElement(rectangle)
    canvas.selectAll()

    expect(canvas.getStyle()).toMatchObject({
      cornerRadius: 6,
      fillColor: "#abcdef",
      opacity: 0.4,
      strokeColor: "#f00",
      strokeWidth: 4,
    })
  })

  it("includes text style options for selected text", () => {
    const text = createText({
      autoSize: false,
      fontFamily: "monospace",
      fontSize: 30,
      height: 40,
      id: "text",
      lineHeight: 1.5,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      text: "Hello",
      textAlign: "center",
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const canvas = new AdrawCanvas()
    canvas.addElement(text)
    canvas.selectAll()

    expect(canvas.getStyle()).toMatchObject({
      autoSize: false,
      fontFamily: "monospace",
      fontSize: 30,
      lineHeight: 1.5,
      textAlign: "center",
    })
  })

  it("returns only the common style of a mixed selection", () => {
    const first = createRectangle({
      cornerRadius: 0,
      height: 50,
      id: "first",
      locked: false,
      rotation: 0,
      strokeColor: "#f00",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const second = createRectangle({
      cornerRadius: 0,
      height: 50,
      id: "second",
      locked: false,
      rotation: 0,
      strokeColor: "#f00",
      strokeWidth: 6,
      visible: true,
      width: 100,
      x: 0,
      y: 60,
      zIndex: 0,
    })
    const canvas = new AdrawCanvas()
    canvas.addElement([first, second])
    canvas.selectAll()

    const style = canvas.getStyle()
    expect(style.strokeColor).toBe("#f00")
    expect(style.strokeWidth).toBeUndefined()
  })

  it("prefers the selected element style over the global style", () => {
    const rectangle = createRectangle({
      cornerRadius: 0,
      height: 50,
      id: "rect",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 9,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const canvas = new AdrawCanvas()
    canvas.setStyle({ strokeWidth: 2 })
    canvas.addElement(rectangle)
    canvas.selectAll()

    expect(canvas.getStyle().strokeWidth).toBe(9)
  })

  it("falls back to the global style when nothing is selected", () => {
    const canvas = new AdrawCanvas()
    canvas.setActiveTool("select")

    expect(canvas.getStyle()).toMatchObject({
      opacity: 1,
      strokeColor: STROKE_COLOR,
      strokeWidth: STROKE_WIDTH,
    })

    canvas.setStyle({ opacity: 0.5, strokeWidth: 8 })
    expect(canvas.getStyle()).toMatchObject({ opacity: 0.5, strokeWidth: 8 })

    canvas.setStyle({ strokeColor: "#0f0" })
    expect(canvas.getStyle().strokeColor).toBe("#0f0")
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
    const canvas = new AdrawCanvas({ container })
    canvas.setCanvasSize(800, 600)
    canvas.setStyle({
      cornerRadius: 9,
      fillColor: "#ffd43b",
      opacity: 0.4,
      strokeWidth: 6,
    })

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
    expect(node.getAttribute("fill")).toBe("#ffd43b")
    expect(node.parentElement?.getAttribute("opacity")).toBe("0.4")

    canvas.selectAll()
    canvas.setStyle({
      cornerRadius: 3,
      fillColor: "#40c057",
      opacity: 1,
      strokeWidth: 2,
    })

    expect(node.getAttribute("rx")).toBe("3")
    expect(node.getAttribute("stroke-width")).toBe("2")
    expect(node.getAttribute("fill")).toBe("#40c057")
    expect(node.parentElement?.hasAttribute("opacity")).toBe(false)
  })

  it("keeps freehand paths unfilled", () => {
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
    canvas.setStyle({ fillColor: "#f00", opacity: 0.5 })
    canvas.setActiveTool("draw")

    const svg = container.querySelector("svg")!
    for (const [type, point] of [
      ["pointerdown", { x: 200, y: 200 }],
      ["pointermove", { x: 300, y: 260 }],
      ["pointerup", { x: 300, y: 260 }],
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

    const path = findElement(canvas, "path")
    const node = container.querySelector(
      `[id="${path.id}"] path`,
    ) as SVGPathElement
    expect(node.getAttribute("fill")).toBe("none")
    expect(node.parentElement?.getAttribute("opacity")).toBe("0.5")

    canvas.selectAll()
    canvas.setStyle({ fillColor: "#0f0" })
    expect(node.getAttribute("fill")).toBe("none")
    expect("fillColor" in path).toBe(false)
  })

  it("uses the global font size for the inline editor preview", () => {
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
    canvas.setStyle({ fontSize: 36 })
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
    svg.dispatchEvent(
      new PointerEvent("pointerup", {
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

  it("keeps the default text font family when no style overrides it", () => {
    const canvas = new AdrawCanvas()
    expect(canvas.getStyle().fontFamily).toBeUndefined()

    canvas.setStyle({ fontFamily: TEXT_FONT_FAMILY })
    expect(canvas.getStyle().fontFamily).toBe(TEXT_FONT_FAMILY)
  })
})
