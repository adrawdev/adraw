// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas, type AdrawCanvasOptions } from "../canvas"

function keydown(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  })
}

describe("keyboard scope and teardown", () => {
  let container: HTMLDivElement
  let canvas: AdrawCanvas | null = null

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    )
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    canvas?.destroy()
    canvas = null
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  function mount(options: AdrawCanvasOptions = {}) {
    const instance = new AdrawCanvas({ container, ...options })
    canvas = instance
    const svg = container.querySelector("svg")
    if (!svg) {
      throw new Error("canvas did not mount")
    }
    return { canvas: instance, svg: svg as SVGSVGElement }
  }

  it("scopes shortcuts to the focused canvas by default", () => {
    const { canvas: instance, svg } = mount()

    expect(svg.tabIndex).toBe(0)

    document.dispatchEvent(keydown({ key: "r" }))
    expect(instance.getActiveTool()).toBe("select")

    svg.dispatchEvent(keydown({ key: "r" }))
    expect(instance.getActiveTool()).toBe("rectangle")
  })

  it("toggles the tool lock with Q", () => {
    const { canvas: instance, svg } = mount()

    expect(instance.getIsToolLocked()).toBe(false)

    svg.dispatchEvent(keydown({ key: "q" }))
    expect(instance.getIsToolLocked()).toBe(true)

    svg.dispatchEvent(keydown({ key: "Q" }))
    expect(instance.getIsToolLocked()).toBe(false)
  })

  it("focuses the canvas on pointer down", () => {
    const { svg } = mount()
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
      }),
    )

    expect(document.activeElement).toBe(svg)
  })

  it("handles shortcuts document-wide with keyboard: document", () => {
    const { canvas: instance, svg } = mount({ keyboard: "document" })

    expect(svg.hasAttribute("tabindex")).toBe(false)

    document.dispatchEvent(keydown({ key: "e" }))
    expect(instance.getActiveTool()).toBe("eraser")
  })

  it("leaves form controls alone with keyboard: document", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    const input = document.createElement("input")
    document.body.appendChild(input)

    const undo = keydown({ ctrlKey: true, key: "z" })
    input.dispatchEvent(undo)

    expect(undo.defaultPrevented).toBe(false)
    expect(instance.getActiveTool()).toBe("select")
  })

  it("ignores selects and contenteditable targets with keyboard: document", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    const select = document.createElement("select")
    select.appendChild(document.createElement("option"))
    document.body.appendChild(select)

    const toolKey = keydown({ key: "r" })
    select.dispatchEvent(toolKey)

    expect(toolKey.defaultPrevented).toBe(false)
    expect(instance.getActiveTool()).toBe("select")

    const editable = document.createElement("div")
    editable.contentEditable = "true"
    const child = document.createElement("span")
    child.textContent = "finding"
    editable.appendChild(child)
    document.body.appendChild(editable)

    const undo = keydown({ ctrlKey: true, key: "z" })
    child.dispatchEvent(undo)

    expect(undo.defaultPrevented).toBe(false)
    expect(instance.getActiveTool()).toBe("select")
  })

  it("disables built-in shortcuts with keyboard: none", () => {
    const { canvas: instance, svg } = mount({ keyboard: "none" })

    expect(svg.hasAttribute("tabindex")).toBe(false)

    document.dispatchEvent(keydown({ key: "r" }))
    svg.dispatchEvent(keydown({ key: "e" }))

    expect(instance.getActiveTool()).toBe("select")
  })

  it("removes the document listener on destroy", () => {
    const { canvas: instance } = mount({ keyboard: "document" })

    document.dispatchEvent(keydown({ key: "r" }))
    expect(instance.getActiveTool()).toBe("rectangle")

    instance.destroy()
    document.dispatchEvent(keydown({ key: "e" }))

    expect(instance.getActiveTool()).toBe("rectangle")
  })

  it("does not stack listeners when destroyed and mounted again", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    instance.destroy()
    instance.mount(container)

    const handleKeyDown = vi.spyOn(instance, "handleKeyDown")
    document.dispatchEvent(keydown({ key: "e" }))

    expect(handleKeyDown).toHaveBeenCalledTimes(1)
  })
})
