// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"

describe("snap guide rendering", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("renders alignment guides during a snapped drag and clears them on release", () => {
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
      snapping: { threshold: 5 },
    })

    const target = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 300,
      y: 0,
      zIndex: 0,
    })
    const mover = createRectangle({
      cornerRadius: 0,
      height: 100,
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
    canvas.getElements().set(target.id, target)
    canvas.getElements().set(mover.id, mover)
    canvas.render()

    const svg = container.querySelector("svg")!
    const dispatch = (
      type: string,
      x: number,
      y: number,
      ctrlKey = false,
    ): void => {
      svg.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: y,
          ctrlKey,
        }),
      )
    }

    dispatch("pointerdown", 50, 50)
    dispatch("pointermove", 347, 60, true)

    expect(canvas.getElements().get(mover.id)!.x).toBe(300)
    const guides = container.querySelectorAll(".adraw-snap-guide")
    expect(guides).toHaveLength(1)
    expect(guides[0].getAttribute("x1")).toBe("300")
    expect(guides[0].getAttribute("x2")).toBe("300")

    dispatch("pointerup", 347, 60, true)
    expect(container.querySelectorAll(".adraw-snap-guide")).toHaveLength(0)
  })
})
