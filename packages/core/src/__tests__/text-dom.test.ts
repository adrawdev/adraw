// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"

describe("text editor DOM integration", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("keeps the canvas stacking context unchanged and hides the duplicate preview", () => {
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
    canvas.setStrokeColor("#ff00aa")
    canvas.setActiveTool("text")

    const svg = container.querySelector("svg")!
    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(editor!.style.color).toBe("#ff00aa")
    expect(container.style.position).toBe("")
    expect(editor!.parentElement).toBe(document.body)
    expect(editor!.style.userSelect).toBe("text")

    editor!.value = "Hello"
    editor!.dispatchEvent(new Event("input", { bubbles: true }))

    const textGroup = container.querySelector(".adraw-temporary") as SVGGElement
    expect(textGroup.textContent).toBe("Hello")
    expect(textGroup.querySelector("text")?.style.userSelect).toBe("none")
    expect(getComputedStyle(textGroup).visibility).toBe("hidden")

    editor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(textGroup.style.visibility).toBe("")
  })

  it("hides the committed text while editing it in place", () => {
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
    canvas.setStrokeColor("#ff00aa")
    canvas.setActiveTool("text")

    const svg = container.querySelector("svg")!
    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
        pointerId: 1,
      }),
    )
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")!
    editor.value = "Hello"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    editor.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    )

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 100,
        clientY: 100,
      }),
    )

    const existingEditor =
      document.querySelector<HTMLTextAreaElement>("textarea")
    const textGroup = container.querySelector(".adraw-temporary") as SVGGElement
    expect(existingEditor?.value).toBe("Hello")
    expect(existingEditor?.style.color).toBe("#ff00aa")
    expect(getComputedStyle(textGroup).visibility).toBe("hidden")

    existingEditor!.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(textGroup.style.visibility).toBe("")
  })
})
