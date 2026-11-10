// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"

function mount(): { canvas: AdrawCanvas; container: HTMLElement } {
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
  canvas.render()
  return { canvas, container }
}

function gridGroup(container: HTMLElement): SVGGElement {
  return container.querySelector<SVGGElement>(".adraw-grid-group")!
}

describe("grid rendering", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("is hidden by default and sits behind the elements", () => {
    const { container } = mount()
    const svg = container.querySelector("svg")!
    const group = gridGroup(container)

    expect(group.style.display).toBe("none")
    const classes = [...svg.children].map((child) =>
      child.getAttribute("class"),
    )
    expect(classes.indexOf("adraw-grid-group")).toBeLessThan(
      classes.indexOf("adraw-elements-group"),
    )
  })

  it("renders a world-anchored pattern and covers the visible area", () => {
    const { canvas, container } = mount()

    canvas.setGridConfig({ enabled: true })

    const group = gridGroup(container)
    const pattern = container.querySelector("pattern")!
    const line = pattern.querySelector("path")!
    const rect = group.querySelector("rect")!

    expect(group.style.display).toBe("")
    expect(pattern.getAttribute("patternUnits")).toBe("userSpaceOnUse")
    expect(pattern.getAttribute("width")).toBe("20")
    expect(pattern.getAttribute("height")).toBe("20")
    expect(line.getAttribute("d")).toBe("M 20 0.5 L 0.5 0.5 L 0.5 20")
    expect(line.getAttribute("stroke-width")).toBe("1")
    expect(line.getAttribute("stroke")).toContain("--adraw-grid")
    expect(line.getAttribute("opacity")).toContain("--adraw-grid-opacity")
    expect(rect.getAttribute("x")).toBe("-400")
    expect(rect.getAttribute("y")).toBe("-300")
    expect(rect.getAttribute("width")).toBe("800")
    expect(rect.getAttribute("height")).toBe("600")
    expect(rect.getAttribute("fill")).toBe(`url(#${pattern.id})`)
  })

  it("keeps grid lines readable at low zoom", () => {
    const { canvas, container } = mount()
    canvas.setGridConfig({ enabled: true })

    canvas.setViewport({ x: 100, y: 50, zoom: 0.1 })

    const pattern = container.querySelector("pattern")!
    const line = pattern.querySelector("path")!
    const rect = gridGroup(container).querySelector("rect")!

    expect(pattern.getAttribute("width")).toBe("80")
    expect(pattern.getAttribute("height")).toBe("80")
    expect(line.getAttribute("d")).toBe("M 80 5 L 5 5 L 5 80")
    expect(line.getAttribute("stroke-width")).toBe("10")
    expect(rect.getAttribute("x")).toBe("-3900")
    expect(rect.getAttribute("y")).toBe("-2950")
    expect(rect.getAttribute("width")).toBe("8000")
    expect(rect.getAttribute("height")).toBe("6000")
  })

  it("updates spacing at runtime and hides again when disabled", () => {
    const { canvas, container } = mount()
    canvas.setGridConfig({ enabled: true, size: 20 })

    canvas.setGridConfig({ size: 50 })
    expect(container.querySelector("pattern")!.getAttribute("width")).toBe("50")

    canvas.setGridConfig({ enabled: false })
    expect(gridGroup(container).style.display).toBe("none")
  })

  it("keeps the grid out of image exports", async () => {
    const { canvas, container } = mount()
    canvas.setGridConfig({ enabled: true })
    canvas.addElement(
      createRectangle({
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
      }),
    )
    expect(container.querySelector(".adraw-grid-group")).not.toBeNull()

    const blob = await canvas.toImage({ format: "svg" })
    const svg = await blob.text()

    expect(svg).not.toContain("adraw-grid")
    expect(svg).not.toContain("<pattern")
  })
})
