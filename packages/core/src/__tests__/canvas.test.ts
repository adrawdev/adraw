import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"

function pointerEvent(): PointerEvent {
  return {
    ctrlKey: false,
    shiftKey: false,
    target: {
      getAttribute: () => null,
    },
  } as unknown as PointerEvent
}

describe("insertMedia", () => {
  it("returns an empty array for an empty input array", () => {
    const canvas = new AdrawCanvas()

    expect(canvas.insertMedia([])).toEqual([])
  })

  it("accepts a single descriptor (not wrapped in an array)", () => {
    const canvas = new AdrawCanvas()

    const result = canvas.insertMedia({
      mimeType: "image/png",
      naturalHeight: 100,
      naturalWidth: 100,
      src: "data:image/png,1",
    })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("media")
  })

  it("inserts multiple elements with increasing zIndex", () => {
    const canvas = new AdrawCanvas()

    const result = canvas.insertMedia([
      {
        height: 10,
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,1",
        width: 10,
        x: 0,
        y: 0,
      },
      {
        height: 20,
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,2",
        width: 20,
        x: 0,
        y: 0,
      },
    ])

    expect(result[0].zIndex).toBe(1)
    expect(result[1].zIndex).toBe(2)
  })

  it("moves a newly drawn element instead of the image underneath it", () => {
    const canvas = new AdrawCanvas()
    const [image] = canvas.insertMedia({
      height: 100,
      mimeType: "image/png",
      naturalHeight: 100,
      naturalWidth: 100,
      src: "data:image/png,1",
      width: 100,
      x: 0,
      y: 0,
    })

    canvas.setActiveTool("rectangle")
    canvas.handlePointerDown(10, 10, pointerEvent())
    canvas.handlePointerMove(90, 90, pointerEvent())
    canvas.handlePointerUp(90, 90, pointerEvent())

    const rectangle = [...canvas.getElements().values()].find(
      (element) => element.type === "rectangle",
    )!

    expect(rectangle.zIndex).toBeGreaterThan(image.zIndex)

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(70, 70, pointerEvent())
    canvas.handlePointerUp(70, 70, pointerEvent())

    expect(canvas.getElements().get(image.id)?.x).toBe(0)
    expect(canvas.getElements().get(image.id)?.y).toBe(0)
    expect(canvas.getElements().get(rectangle.id)?.x).toBe(30)
    expect(canvas.getElements().get(rectangle.id)?.y).toBe(30)
  })

  describe("width and height defaults", () => {
    it("uses explicit width and height when both are provided", () => {
      const canvas = new AdrawCanvas()

      const result = canvas.insertMedia({
        height: 50,
        mimeType: "image/png",
        naturalHeight: 200,
        naturalWidth: 400,
        src: "data:image/png,1",
        width: 100,
        x: 0,
        y: 0,
      })

      expect(result[0].width).toBe(100)
      expect(result[0].height).toBe(50)
    })

    it("derives height from width to maintain aspect ratio", () => {
      const canvas = new AdrawCanvas()

      const result = canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 200,
        naturalWidth: 400,
        src: "data:image/png,1",
        width: 100,
        x: 0,
        y: 0,
      })

      // 100 / 400 * 200 = 50
      expect(result[0].width).toBe(100)
      expect(result[0].height).toBe(50)
    })

    it("derives width from height to maintain aspect ratio", () => {
      const canvas = new AdrawCanvas()

      const result = canvas.insertMedia({
        height: 50,
        mimeType: "image/png",
        naturalHeight: 200,
        naturalWidth: 400,
        src: "data:image/png,1",
        x: 0,
        y: 0,
      })

      // 50 / 200 * 400 = 100
      expect(result[0].width).toBe(100)
      expect(result[0].height).toBe(50)
    })

    it("falls back to natural size when canvas is unmounted (headless)", () => {
      const canvas = new AdrawCanvas()

      const result = canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 200,
        naturalWidth: 400,
        src: "data:image/png,1",
        x: 0,
        y: 0,
      })

      expect(result[0].width).toBe(400)
      expect(result[0].height).toBe(200)
    })

    it("scales to fit the visible viewport area when mounted", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 1 },
      })
      canvas.setCanvasSize(1000, 800)

      // 1920x1080 image in a 1000x800px viewport at zoom=1
      // visible: 1000x800 canvas coords
      // available (w/ 100px padding): 900x700
      // scaleX = 900/1920 = 0.46875, scaleY = 700/1080 = 0.648
      // scale = min(0.46875, 0.648, 1) = 0.46875
      // width = round(1920 * 0.46875) = 900
      // height = round(1080 * 0.46875) = 506
      const result = canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 1080,
        naturalWidth: 1920,
        src: "data:image/png,1",
      })

      expect(result[0].width).toBe(900)
      expect(result[0].height).toBe(506)
    })

    it("does not upscale images smaller than the viewport", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 1 },
      })
      canvas.setCanvasSize(1000, 800)

      const result = canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 50,
        naturalWidth: 100,
        src: "data:image/png,1",
      })

      expect(result[0].width).toBe(100)
      expect(result[0].height).toBe(50)
    })

    it("scales correctly under non-default zoom", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 2 },
      })
      canvas.setCanvasSize(1000, 800)

      // visible: 1000/2 x 800/2 = 500x400 canvas coords
      // available (w/ 100/2=50px padding): 450x350
      // scaleX = 450/1920 = 0.234375, scaleY = 350/1080 = 0.324
      // scale = min(0.234375, 0.324, 1) = 0.234375
      // width = round(1920 * 0.234375) = 450
      // height = round(1080 * 0.234375) = 253
      const result = canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 1080,
        naturalWidth: 1920,
        src: "data:image/png,1",
      })

      expect(result[0].width).toBe(450)
      expect(result[0].height).toBe(253)
    })
  })

  describe("position defaults", () => {
    it("uses explicit x and y when both are provided", () => {
      const canvas = new AdrawCanvas()

      const result = canvas.insertMedia({
        height: 10,
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,1",
        width: 10,
        x: 25,
        y: 35,
      })

      expect(result[0].x).toBe(25)
      expect(result[0].y).toBe(35)
    })

    it("centers in the viewport when neither x nor y is provided", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 1 },
      })

      const result = canvas.insertMedia({
        height: 100,
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,1",
        width: 100,
      })

      expect(result[0].x).toBe(450)
      expect(result[0].y).toBe(350)
    })

    it("centers the unspecified axis when only x is given", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 1 },
      })

      const result = canvas.insertMedia({
        height: 100,
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,1",
        width: 100,
        x: 100,
      })

      expect(result[0].x).toBe(100)
      expect(result[0].y).toBe(350)
    })

    it("centers the unspecified axis when only y is given", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 1 },
      })

      const result = canvas.insertMedia({
        height: 100,
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,1",
        width: 100,
        y: 200,
      })

      expect(result[0].x).toBe(450)
      expect(result[0].y).toBe(200)
    })

    it("centers at viewport center when headless (no canvas size)", () => {
      const canvas = new AdrawCanvas({
        initialViewport: { x: 500, y: 400, zoom: 1 },
      })

      const result = canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 100,
        naturalWidth: 100,
        src: "data:image/png,1",
      })

      // natural size = 100x100, viewport centered at 500,400
      expect(result[0].x).toBe(450)
      expect(result[0].y).toBe(350)
    })
  })
})
