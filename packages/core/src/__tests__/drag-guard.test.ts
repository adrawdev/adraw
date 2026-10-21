// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"

describe("native drag guard", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  function mount() {
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
    const svg = container.querySelector("svg")
    if (!svg) {
      throw new Error("canvas did not mount")
    }
    return { canvas, svg }
  }

  function dragStart(target: Element): Event {
    const event = new Event("dragstart", { bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
  }

  it("prevents native dragging from starting on the canvas", () => {
    const { canvas, svg } = mount()
    const elementsGroup = svg.querySelector(".adraw-elements-group")
    if (!elementsGroup) {
      throw new Error("elements group missing")
    }

    expect(dragStart(svg).defaultPrevented).toBe(true)
    expect(dragStart(elementsGroup).defaultPrevented).toBe(true)

    canvas.destroy()
  })

  it("stops preventing native dragging after destroy", () => {
    const { canvas, svg } = mount()

    canvas.destroy()

    expect(dragStart(svg).defaultPrevented).toBe(false)
  })
})
