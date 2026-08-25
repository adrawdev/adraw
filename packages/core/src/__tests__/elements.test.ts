import { describe, expect, it } from "vitest"

import {
  cloneElement,
  createEllipse,
  createGroup,
  createMedia,
  createPath,
  createRectangle,
  getElementAtPoint,
  getElementsBounds,
  moveElement,
  resizeElement,
  rotateElement,
} from "../elements"
import type { CanvasElement, ElementId, RectangleElement } from "../types"

function makeRect(overrides: Partial<RectangleElement> = {}): RectangleElement {
  return createRectangle({
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
    ...overrides,
  })
}

function toMap(elements: CanvasElement[]): Map<ElementId, CanvasElement> {
  return new Map(elements.map((el) => [el.id, el]))
}

describe("elements", () => {
  describe("factories", () => {
    it("createRectangle assigns type and generated id", () => {
      const rect = createRectangle({
        cornerRadius: 4,
        height: 10,
        locked: false,
        rotation: 0,
        strokeColor: "#000",
        strokeWidth: 2,
        visible: true,
        width: 20,
        x: 1,
        y: 2,
        zIndex: 0,
      })

      expect(rect.type).toBe("rectangle")
      expect(rect.id).toBeTruthy()
      expect(rect.cornerRadius).toBe(4)
    })

    it("respects an explicitly provided id", () => {
      const rect = makeRect({ id: "fixed-id" })

      expect(rect.id).toBe("fixed-id")
    })

    it("createEllipse assigns ellipse type", () => {
      const ellipse = createEllipse({
        height: 10,
        locked: false,
        rotation: 0,
        strokeColor: "#000",
        strokeWidth: 2,
        visible: true,
        width: 10,
        x: 0,
        y: 0,
        zIndex: 0,
      })

      expect(ellipse.type).toBe("ellipse")
    })

    it("createPath defaults points to an empty array", () => {
      const path = createPath({
        fillColor: "#000",
        height: 0,
        locked: false,
        rotation: 0,
        strokeColor: "#000",
        strokeWidth: 1,
        visible: true,
        width: 0,
        x: 0,
        y: 0,
        zIndex: 0,
      } as never)

      expect(path.type).toBe("path")
      expect(path.points).toEqual([])
    })

    it("createMedia assigns media type", () => {
      const media = createMedia({
        height: 10,
        locked: false,
        mimeType: "image/png",
        naturalHeight: 10,
        naturalWidth: 10,
        rotation: 0,
        src: "data:...",
        visible: true,
        width: 10,
        x: 0,
        y: 0,
        zIndex: 0,
      })

      expect(media.type).toBe("media")
    })

    it("createGroup defaults children to an empty array", () => {
      const group = createGroup({
        height: 10,
        locked: false,
        rotation: 0,
        visible: true,
        width: 10,
        x: 0,
        y: 0,
        zIndex: 0,
      } as never)

      expect(group.type).toBe("group")
      expect(group.children).toEqual([])
    })
  })

  describe("cloneElement", () => {
    it("returns a new id and default offset", () => {
      const rect = makeRect({ id: "original", x: 10, y: 20 })
      const clone = cloneElement(rect)

      expect(clone.id).not.toBe(rect.id)
      expect(clone.x).toBe(30)
      expect(clone.y).toBe(40)
    })

    it("applies a custom offset", () => {
      const rect = makeRect({ x: 0, y: 0 })
      const clone = cloneElement(rect, { x: 5, y: -5 })

      expect(clone.x).toBe(5)
      expect(clone.y).toBe(-5)
    })

    it("does not mutate the original element", () => {
      const rect = makeRect({ x: 0, y: 0 })
      cloneElement(rect)

      expect(rect.x).toBe(0)
      expect(rect.y).toBe(0)
    })
  })

  describe("moveElement", () => {
    it("offsets the element by the delta", () => {
      const rect = makeRect({ x: 10, y: 10 })
      const moved = moveElement(rect, { x: 5, y: -3 })

      expect(moved.x).toBe(15)
      expect(moved.y).toBe(7)
      expect(moved.id).toBe(rect.id)
    })
  })

  describe("resizeElement", () => {
    it("resizes from top-left keeping origin", () => {
      const rect = makeRect({ height: 100, width: 100, x: 10, y: 10 })
      const resized = resizeElement(rect, 50, 50, "top-left")

      expect(resized.x).toBe(10)
      expect(resized.y).toBe(10)
      expect(resized.width).toBe(50)
      expect(resized.height).toBe(50)
    })

    it("resizes from bottom-right moving the origin", () => {
      const rect = makeRect({ height: 100, width: 100, x: 0, y: 0 })
      const resized = resizeElement(rect, 60, 40, "bottom-right")

      expect(resized.x).toBe(40)
      expect(resized.y).toBe(60)
      expect(resized.width).toBe(60)
      expect(resized.height).toBe(40)
    })

    it("resizes from center keeping the center fixed", () => {
      const rect = makeRect({ height: 100, width: 100, x: 0, y: 0 })
      const resized = resizeElement(rect, 50, 50, "center")

      expect(resized.x).toBe(25)
      expect(resized.y).toBe(25)
    })

    it("clamps width and height to a minimum of 1", () => {
      const rect = makeRect()
      const resized = resizeElement(rect, -10, 0, "top-left")

      expect(resized.width).toBe(1)
      expect(resized.height).toBe(1)
    })
  })

  describe("rotateElement", () => {
    it("sets rotation modulo 360", () => {
      const rect = makeRect()

      expect(rotateElement(rect, 45).rotation).toBe(45)
      expect(rotateElement(rect, 450).rotation).toBe(90)
    })
  })

  describe("getElementsBounds", () => {
    it("returns null when there are no elements", () => {
      expect(getElementsBounds(new Map())).toBeNull()
    })

    it("ignores invisible elements", () => {
      const elements = toMap([makeRect({ id: "hidden", visible: false })])

      expect(getElementsBounds(elements)).toBeNull()
    })

    it("computes the union bounds of multiple elements", () => {
      const elements = toMap([
        makeRect({ height: 50, id: "a", width: 50, x: 0, y: 0 }),
        makeRect({ height: 50, id: "b", width: 50, x: 100, y: 100 }),
      ])

      const bounds = getElementsBounds(elements)

      expect(bounds).toEqual({
        bottom: 150,
        height: 150,
        left: 0,
        right: 150,
        top: 0,
        width: 150,
        x: 0,
        y: 0,
      })
    })

    it("restricts to the provided id set", () => {
      const elements = toMap([
        makeRect({ height: 50, id: "a", width: 50, x: 0, y: 0 }),
        makeRect({ height: 50, id: "b", width: 50, x: 100, y: 100 }),
      ])

      const bounds = getElementsBounds(elements, new Set(["a"]))

      expect(bounds?.right).toBe(50)
      expect(bounds?.bottom).toBe(50)
    })
  })

  describe("getElementAtPoint", () => {
    it("returns the topmost element by zIndex", () => {
      const elements = toMap([
        makeRect({ id: "below", zIndex: 0 }),
        makeRect({ id: "above", zIndex: 1 }),
      ])

      const hit = getElementAtPoint(elements, { x: 50, y: 50 })

      expect(hit?.id).toBe("above")
    })

    it("returns null when no element contains the point", () => {
      const elements = toMap([makeRect({ id: "a" })])

      expect(getElementAtPoint(elements, { x: 500, y: 500 })).toBeNull()
    })

    it("skips locked and invisible elements", () => {
      const elements = toMap([
        makeRect({ id: "locked", locked: true }),
        makeRect({ id: "hidden", visible: false }),
      ])

      expect(getElementAtPoint(elements, { x: 50, y: 50 })).toBeNull()
    })

    it("hit-tests a rotated element", () => {
      const elements = toMap([
        makeRect({ height: 40, id: "r", rotation: 45, width: 40, x: 0, y: 0 }),
      ])

      // The center is always inside regardless of rotation.
      expect(getElementAtPoint(elements, { x: 20, y: 20 })?.id).toBe("r")
      // A corner that leaves the rotated box should miss.
      expect(getElementAtPoint(elements, { x: 1, y: 1 })).toBeNull()
    })
  })
})
