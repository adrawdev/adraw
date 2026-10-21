import { describe, expect, it } from "vitest"

import {
  canvasToScreen,
  clamp,
  distanceBetweenPoints,
  generateId,
  getElementBounds,
  pointInBounds,
  screenToCanvas,
} from "../coordinates"

describe("coordinates", () => {
  describe("screenToCanvas", () => {
    it("converts screen point to canvas point at zoom 1", () => {
      const viewport = { x: 0, y: 0, zoom: 1 }
      const canvasSize = { height: 600, width: 800 }
      const screenPoint = { x: 400, y: 300 }

      const result = screenToCanvas(screenPoint, viewport, canvasSize)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
    })

    it("converts screen point with pan offset", () => {
      const viewport = { x: 100, y: 50, zoom: 1 }
      const canvasSize = { height: 600, width: 800 }
      const screenPoint = { x: 400, y: 300 }

      const result = screenToCanvas(screenPoint, viewport, canvasSize)

      expect(result.x).toBe(100)
      expect(result.y).toBe(50)
    })

    it("converts screen point with zoom", () => {
      const viewport = { x: 0, y: 0, zoom: 2 }
      const canvasSize = { height: 600, width: 800 }
      const screenPoint = { x: 400, y: 300 }

      const result = screenToCanvas(screenPoint, viewport, canvasSize)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
    })
  })

  describe("canvasToScreen", () => {
    it("converts canvas point to screen point at zoom 1", () => {
      const viewport = { x: 0, y: 0, zoom: 1 }
      const canvasSize = { height: 600, width: 800 }
      const canvasPoint = { x: 0, y: 0 }

      const result = canvasToScreen(canvasPoint, viewport, canvasSize)

      expect(result.x).toBe(400)
      expect(result.y).toBe(300)
    })
  })

  describe("getElementBounds", () => {
    it("returns bounds without rotation", () => {
      const result = getElementBounds(10, 20, 100, 50, 0)

      expect(result.left).toBe(10)
      expect(result.right).toBe(110)
      expect(result.top).toBe(20)
      expect(result.bottom).toBe(70)
      expect(result.center.x).toBe(60)
      expect(result.center.y).toBe(45)
    })

    it("returns the axis-aligned bounds of a rotated rectangle", () => {
      const result = getElementBounds(10, 20, 100, 50, 90)

      expect(result.left).toBe(35)
      expect(result.right).toBe(85)
      expect(result.top).toBe(-5)
      expect(result.bottom).toBe(95)
      expect(result.center.x).toBe(60)
      expect(result.center.y).toBe(45)
    })
  })

  describe("pointInBounds", () => {
    it("returns true when point is inside bounds", () => {
      const bounds = { bottom: 100, left: 0, right: 100, top: 0 }
      const point = { x: 50, y: 50 }

      expect(pointInBounds(point, bounds)).toBe(true)
    })

    it("returns false when point is outside bounds", () => {
      const bounds = { bottom: 100, left: 0, right: 100, top: 0 }
      const point = { x: 150, y: 50 }

      expect(pointInBounds(point, bounds)).toBe(false)
    })
  })

  describe("distanceBetweenPoints", () => {
    it("calculates distance between two points", () => {
      const p1 = { x: 0, y: 0 }
      const p2 = { x: 3, y: 4 }

      expect(distanceBetweenPoints(p1, p2)).toBe(5)
    })
  })

  describe("clamp", () => {
    it("clamps value within range", () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe("generateId", () => {
    it("generates unique ids", () => {
      const id1 = generateId()
      const id2 = generateId()

      expect(id1).not.toBe(id2)
    })
  })
})
