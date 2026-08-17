// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"
import type { CanvasElement, ElementId } from "../types"

function getOverlayGroupTransform(canvas: AdrawCanvas): string | null {
  const svg = (canvas as any).mounted.state.svgElement as SVGSVGElement | null
  if (!svg) {
    return null
  }
  const overlay = svg.querySelector(
    ".adraw-transform-overlay",
  ) as SVGGElement | null
  if (!overlay) {
    return null
  }
  const group = overlay.firstElementChild as SVGElement | null
  if (!group) {
    return null
  }
  return group.getAttribute("transform")
}

describe("transform overlay rotation with multi-selection", () => {
  let container: HTMLDivElement
  let canvas: AdrawCanvas

  function setElements(elements: CanvasElement[]) {
    ;(canvas as any).engine.elements = new Map<ElementId, CanvasElement>(
      elements.map((el) => [el.id, el]),
    )
  }

  function setSelectedIds(ids: ElementId[]) {
    ;(canvas as any).engine.selectedIds = new Set(ids)
  }

  beforeEach(() => {
    container = document.createElement("div")
    container.style.width = "800px"
    container.style.height = "600px"
    document.body.appendChild(container)
    canvas = new AdrawCanvas({ container })
  })

  afterEach(() => {
    canvas.destroy()
    container.remove()
  })

  it("rotates overlay for a single rotated element", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 45,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    setElements([rect])
    setSelectedIds([rect.id])
    canvas.render()

    expect(getOverlayGroupTransform(canvas)).toBe("rotate(45, 50, 50)")
  })

  it("does not rotate overlay for a single element with zero rotation", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    setElements([rect])
    setSelectedIds([rect.id])
    canvas.render()

    expect(getOverlayGroupTransform(canvas)).toBeNull()
  })

  it("does not rotate overlay when selected elements have different rotations", () => {
    const a = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 45,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const b = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 90,
      visible: true,
      width: 100,
      x: 200,
      y: 0,
      zIndex: 0,
    })
    setElements([a, b])
    setSelectedIds([a.id, b.id])
    canvas.render()

    expect(getOverlayGroupTransform(canvas)).toBeNull()
  })

  it("does not rotate overlay when selected elements all have zero rotation", () => {
    const a = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const b = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      visible: true,
      width: 100,
      x: 200,
      y: 0,
      zIndex: 0,
    })
    setElements([a, b])
    setSelectedIds([a.id, b.id])
    canvas.render()

    expect(getOverlayGroupTransform(canvas)).toBeNull()
  })

  it("does not rotate overlay when some selected elements have zero and others non-zero rotation", () => {
    const a = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 45,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const b = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      visible: true,
      width: 100,
      x: 200,
      y: 0,
      zIndex: 0,
    })
    setElements([a, b])
    setSelectedIds([a.id, b.id])
    canvas.render()

    expect(getOverlayGroupTransform(canvas)).toBeNull()
  })

  it("removes overlay when switching from select to hand tool", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 45,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    setElements([rect])
    setSelectedIds([rect.id])
    canvas.render()

    expect(getOverlayGroupTransform(canvas)).toBe("rotate(45, 50, 50)")

    canvas.setActiveTool("hand")

    expect(getOverlayGroupTransform(canvas)).toBeNull()
  })

  it("clears selection when select tool is deactivated via tool switch", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    setElements([rect])
    setSelectedIds([rect.id])
    canvas.render()

    expect(canvas.getSelectedIds().size).toBe(1)

    canvas.setActiveTool("hand")

    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("overlay stays hidden when switching back to select after selection was cleared", () => {
    const rect = createRectangle({
      cornerRadius: 0,
      height: 100,
      locked: false,
      rotation: 0,
      visible: true,
      width: 100,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    setElements([rect])
    setSelectedIds([rect.id])
    canvas.render()

    canvas.setActiveTool("hand")
    canvas.setActiveTool("select")

    expect(canvas.getSelectedIds().size).toBe(0)
    expect(getOverlayGroupTransform(canvas)).toBeNull()
  })
})
