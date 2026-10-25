// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createDiamond, createRectangle, createText } from "../elements"
import type { TextElement } from "../types"

function mount(): {
  canvas: AdrawCanvas
  container: HTMLElement
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
    container,
    svg: container.querySelector("svg")!,
  }
}

function firstText(canvas: AdrawCanvas): TextElement {
  const element = [...canvas.getElements().values()].find(
    (candidate) => candidate.type === "text",
  )
  if (element?.type !== "text") {
    throw new Error("No text element")
  }
  return element
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

describe("text editor DOM integration", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("uses an invisible overlay that matches the rendered text", () => {
    const { canvas, container, svg } = mount()
    canvas.setStyle({ strokeColor: "#ff00aa" })
    canvas.setActiveTool("text")

    clickCanvas(svg, 300, 300)

    const editingText = firstText(canvas)
    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds().size).toBe(0)

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(editor!.style.color).toBe("#ff00aa")
    expect(editor!.style.caretColor).toBe("#ff00aa")
    expect(editor!.style.border).toBe("0px")
    expect(editor!.style.background).toBe("transparent")
    expect(editor!.style.fontFamily).toBe("system-ui, sans-serif")
    expect(editor!.style.fontSize).toBe("20px")
    expect(editor!.style.lineHeight).toBe("25px")
    expect(editor!.style.textAlign).toBe("left")
    expect(editor!.style.transform).toBe("scale(1) rotate(0deg)")
    expect(container.style.position).toBe("")
    expect(editor!.parentElement).toBe(document.body)
    expect(editor!.style.userSelect).toBe("text")

    editor!.value = "Hello"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))

    const textGroup = container.querySelector(
      `[id="${editingText.id}"]`,
    ) as SVGGElement
    const renderedText = textGroup.querySelector("text")
    expect(renderedText?.style.userSelect).toBe("none")
    expect(renderedText?.style.getPropertyValue("-webkit-user-select")).toBe(
      "none",
    )
    expect(getComputedStyle(textGroup).visibility).toBe("hidden")

    // Enter inserts a newline in the editor instead of committing.
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    )
    expect(document.querySelector("textarea")).not.toBeNull()

    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(textGroup.style.visibility).toBe("")
    expect(canvas.getSelectedIds().has(editingText.id)).toBe(true)
  })

  it("renders explicit newlines as one tspan per line", () => {
    const { canvas, container, svg } = mount()
    canvas.setActiveTool("text")

    clickCanvas(svg, 300, 300)

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")!
    editor.value = "Hello\nworld"
    editor.dispatchEvent(new Event("input", { bubbles: true }))

    const text = firstText(canvas)
    const textGroup = container.querySelector(
      `[id="${text.id}"]`,
    ) as SVGGElement
    const lines = [...textGroup.querySelectorAll("tspan")].map(
      (line) => line.textContent,
    )
    expect(lines).toEqual(["Hello", "world"])

    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "Enter",
      }),
    )
    expect(document.querySelector("textarea")).toBeNull()
    expect(firstText(canvas).text).toBe("Hello\nworld")
  })

  it("commits the edit on Ctrl+Enter and keeps the element", () => {
    const { canvas, svg } = mount()
    canvas.setActiveTool("text")

    clickCanvas(svg, 300, 300)
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")!
    expect(canvas.getSelectedIds().size).toBe(0)
    editor.value = "Hello"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    editor.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "Enter",
      }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(firstText(canvas).text).toBe("Hello")
    expect(canvas.getSelectedIds().size).toBe(1)
  })

  it("renders initial text content on mount", () => {
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
      initialElements: [
        createText({
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
        }),
      ],
    })

    expect(container.querySelector('[id="text"] text')?.textContent).toBe(
      "Hello",
    )
    canvas.destroy()
  })

  it("rotates and scales the editor with its element", () => {
    const { canvas, svg } = mount()
    const text = createText({
      fontFamily: "monospace",
      fontSize: 20,
      height: 30,
      lineHeight: 1.5,
      locked: false,
      rotation: 45,
      strokeColor: "#000",
      text: "Hello",
      textAlign: "center",
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    canvas.addElement(text)

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 450,
        clientY: 315,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(editor!.style.transform).toBe("scale(1) rotate(45deg)")
    expect(editor!.style.transformOrigin).toBe("center center")
    expect(editor!.style.fontFamily).toBe("monospace")
    expect(editor!.style.fontSize).toBe("20px")
    expect(editor!.style.lineHeight).toBe("30px")
    expect(editor!.style.textAlign).toBe("center")
    expect(editor!.style.width).toBe("100px")
    expect(editor!.style.height).toBe("30px")

    canvas.destroy()
  })

  it("creates a fixed-width text by dragging with the text tool", () => {
    const { canvas, svg } = mount()
    canvas.setActiveTool("text")

    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 300,
        clientY: 300,
        pointerId: 1,
      }),
    )
    svg.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 420,
        clientY: 300,
        pointerId: 1,
      }),
    )
    expect(svg.querySelector(".adraw-selection-box")).not.toBeNull()

    svg.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 420,
        clientY: 300,
        pointerId: 1,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(canvas.getSelectedIds().size).toBe(0)
    editor!.value = "Hello"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    const text = firstText(canvas)
    expect(text.text).toBe("Hello")
    expect(text.autoSize).toBe(false)
    expect(text.width).toBeCloseTo(120)
    expect(canvas.getSelectedIds().has(text.id)).toBe(true)
  })

  it("creates a centered label when double-clicking a shape", () => {
    const { canvas, svg } = mount()
    const rect = createRectangle({
      cornerRadius: 0,
      height: 60,
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
    canvas.addElement(rect)

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 450,
        clientY: 330,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(canvas.getSelectedIds().size).toBe(0)
    editor!.value = "Label"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    const text = firstText(canvas)
    expect(text.containerId).toBe("rect")
    expect(text.text).toBe("Label")
    expect(text.textAlign).toBe("center")
    expect(text.wrapWidth).toBe(90)
    expect(text.width).toBe(60)
    expect(text.x).toBe(20)
    expect(canvas.getSelectedIds().has("rect")).toBe(true)
  })

  it("creates a centered label when double-clicking a diamond", () => {
    const { canvas, svg } = mount()
    const diamond = createDiamond({
      height: 100,
      id: "diamond",
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
    canvas.addElement(diamond)

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 450,
        clientY: 350,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    editor!.value = "Hi"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    const text = firstText(canvas)
    expect(text.containerId).toBe("diamond")
    expect(text.textAlign).toBe("center")
    // The inscribed rectangle is half the diamond's size: 40px after padding.
    expect(text.wrapWidth).toBe(40)
    expect(text.width).toBe(24)
    expect(text.x).toBe(38)
    expect(text.y).toBeCloseTo(37.5)
    expect(canvas.getSelectedIds().has("diamond")).toBe(true)
  })

  it("double-clicking empty canvas creates the same auto-sized editor", () => {
    const { canvas, svg } = mount()

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 300,
        clientY: 300,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds().size).toBe(0)

    editor!.value = "Hello world"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))

    const text = firstText(canvas)
    expect(text.autoSize).toBe(true)
    expect(text.width).toBe(132)
    expect(editor!.style.width).toBe("132px")

    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(firstText(canvas).text).toBe("Hello world")
    expect(canvas.getSelectedIds().has(text.id)).toBe(true)
  })

  it("creates a label when the text tool clicks a shape center", () => {
    const { canvas, svg } = mount()
    const rect = createRectangle({
      cornerRadius: 0,
      height: 60,
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
    canvas.addElement(rect)
    canvas.setActiveTool("text")

    clickCanvas(svg, 450, 330)

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds().size).toBe(0)
    editor!.value = "Inside"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    const text = firstText(canvas)
    expect(text.containerId).toBe("rect")
    expect(text.textAlign).toBe("center")
    expect(canvas.getSelectedIds().has("rect")).toBe(true)
  })

  it("drags a free text out of a shape center instead of binding it", () => {
    const { canvas, svg } = mount()
    const rect = createRectangle({
      cornerRadius: 0,
      height: 60,
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
    canvas.addElement(rect)
    canvas.setActiveTool("text")

    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 450,
        clientY: 330,
        pointerId: 1,
      }),
    )
    svg.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 550,
        clientY: 330,
        pointerId: 1,
      }),
    )
    svg.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        clientX: 550,
        clientY: 330,
        pointerId: 1,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(canvas.getSelectedIds().size).toBe(0)
    editor!.value = "Free"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))
    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    const text = firstText(canvas)
    expect(text.containerId ?? null).toBeNull()
    expect(text.autoSize).toBe(false)
    expect(text.width).toBeCloseTo(100)
    expect(canvas.getSelectedIds().has(text.id)).toBe(true)
  })

  it("hides the committed text while editing it in place", () => {
    const { canvas, container, svg } = mount()
    canvas.setStyle({ strokeColor: "#ff00aa" })
    canvas.setActiveTool("text")

    clickCanvas(svg, 300, 300)
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")!
    editor.value = "Hello"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 300,
        clientY: 300,
      }),
    )

    const existingEditor =
      document.querySelector<HTMLTextAreaElement>("textarea")
    const committed = firstText(canvas)
    const textGroup = container.querySelector(
      `[id="${committed.id}"]`,
    ) as SVGGElement
    expect(existingEditor?.value).toBe("Hello")
    expect(existingEditor?.style.color).toBe("#ff00aa")
    expect(getComputedStyle(textGroup).visibility).toBe("hidden")
    expect(canvas.getSelectedIds().size).toBe(0)

    existingEditor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(textGroup.style.visibility).toBe("")
    expect(canvas.getSelectedIds().has(committed.id)).toBe(true)
  })
})
