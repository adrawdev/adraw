import { describe, expect, it } from "vitest"

import { AdrawCanvas, type AdrawCanvasOptions } from "../canvas"
import type { RectangleElement } from "../types"

function rectangle(
  overrides: Partial<RectangleElement> = {},
): RectangleElement {
  return {
    cornerRadius: 0,
    fillColor: "#fff",
    height: 100,
    id: "rect-1",
    locked: false,
    opacity: 1,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    type: "rectangle",
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    zIndex: 1,
    ...overrides,
  }
}

function createCanvas(options: AdrawCanvasOptions = {}): AdrawCanvas {
  const canvas = new AdrawCanvas(options)
  canvas.setCanvasSize(300, 300)
  return canvas
}

describe("engine viewport config", () => {
  it("clamps the initial viewport to the configured range", () => {
    const canvas = createCanvas({
      initialViewport: { x: 0, y: 0, zoom: 100 },
      viewport: { maxZoom: 4 },
    })

    expect(canvas.getViewport().zoom).toBe(4)
    expect(canvas.getViewportConfig().maxZoom).toBe(4)
  })

  it("applies minZoom and maxZoom to zoom operations", () => {
    const canvas = createCanvas({ viewport: { maxZoom: 2, minZoom: 0.25 } })

    for (let index = 0; index < 30; index += 1) {
      canvas.zoomIn()
    }
    expect(canvas.getViewport().zoom).toBe(2)

    for (let index = 0; index < 100; index += 1) {
      canvas.zoomOut()
    }
    expect(canvas.getViewport().zoom).toBe(0.25)
  })

  it("clamps zoom set through setViewport", () => {
    const canvas = createCanvas({ viewport: { maxZoom: 3 } })

    canvas.setViewport({ x: 10, y: 20, zoom: 10 })

    expect(canvas.getViewport()).toEqual({ x: 10, y: 20, zoom: 3 })
  })

  it("fits explicit bounds with padding", () => {
    const canvas = createCanvas()

    canvas.zoomToFit({
      bounds: { height: 100, width: 100, x: 0, y: 0 },
      padding: 0,
    })

    // 300px canvas / 100px content = 3x, centered on the content.
    expect(canvas.getViewport()).toEqual({ x: 50, y: 50, zoom: 3 })

    canvas.zoomToFit({
      bounds: { bottom: 100, left: 0, right: 100, top: 0 },
      padding: 50,
    })

    // 300px canvas - 2 * 50px padding = 200px available -> 2x.
    expect(canvas.getViewport()).toEqual({ x: 50, y: 50, zoom: 2 })
  })

  it("uses viewport.fitPadding for zoomToFit when padding is omitted", () => {
    const canvas = createCanvas({ viewport: { fitPadding: 50 } })
    canvas.addElement(rectangle(), { history: false })

    canvas.zoomToFit()

    expect(canvas.getViewport().zoom).toBe(2)
  })

  it("keeps content in view and prevents zooming out past the fit", () => {
    const canvas = createCanvas({ viewport: { constrainToContent: true } })
    canvas.addElement(rectangle(), { history: false })

    canvas.zoomToFit({ padding: 0 })
    expect(canvas.getViewport()).toEqual({ x: 50, y: 50, zoom: 3 })

    canvas.zoomOut()
    expect(canvas.getViewport().zoom).toBe(3)

    canvas.setViewport({ x: 999, y: -999, zoom: 3 })
    expect(canvas.getViewport()).toEqual({ x: 50, y: 50, zoom: 3 })
  })

  it("uses explicit fit bounds for the pan constraint", () => {
    const canvas = createCanvas({ viewport: { constrainToContent: true } })

    canvas.zoomToFit({
      bounds: { height: 100, width: 100, x: 0, y: 0 },
      padding: 0,
    })
    expect(canvas.getViewport()).toEqual({ x: 50, y: 50, zoom: 3 })

    canvas.zoomOut()
    expect(canvas.getViewport().zoom).toBe(3)

    canvas.setViewport({ x: 999, y: -999, zoom: 3 })
    expect(canvas.getViewport()).toEqual({ x: 50, y: 50, zoom: 3 })
  })

  it("leaves zoom-free panning unchanged when constrainToContent is off", () => {
    const canvas = createCanvas()
    canvas.addElement(rectangle(), { history: false })

    canvas.zoomToFit({ padding: 0 })
    canvas.zoomOut()
    expect(canvas.getViewport().zoom).toBeLessThan(3)

    canvas.setViewport({ x: 999, y: -999, zoom: 1 })
    expect(canvas.getViewport()).toEqual({ x: 999, y: -999, zoom: 1 })
  })
})
