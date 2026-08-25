import { describe, expect, it } from "vitest"

import { createRectangle } from "../elements"
import {
  calculateSnap,
  createSnappingConfig,
  getAllSnapPoints,
  getElementSnapPoints,
  snapBoundsToElements,
  snapPointToGuides,
} from "../snapping"
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

describe("snapping", () => {
  describe("createSnappingConfig", () => {
    it("provides defaults", () => {
      expect(createSnappingConfig()).toEqual({ enabled: false, threshold: 5 })
    })

    it("merges partial overrides", () => {
      expect(createSnappingConfig({ enabled: true })).toEqual({
        enabled: true,
        threshold: 5,
      })
    })
  })

  describe("getElementSnapPoints", () => {
    it("derives edge and center snap points", () => {
      const rect = makeRect({ height: 100, id: "r", width: 100, x: 0, y: 0 })
      const points = getElementSnapPoints(rect)

      expect(points).toHaveLength(6)
      const types = points.map((p) => p.type)
      expect(types).toContain("left")
      expect(types).toContain("right")
      expect(types).toContain("top")
      expect(types).toContain("bottom")
      expect(types).toContain("center-x")
      expect(types).toContain("center-y")

      const right = points.find((p) => p.type === "right")!
      expect(right.x).toBe(100)
    })
  })

  describe("getAllSnapPoints", () => {
    it("excludes ids, hidden, and locked elements", () => {
      const elements = toMap([
        makeRect({ id: "visible" }),
        makeRect({ id: "excluded" }),
        makeRect({ id: "hidden", visible: false }),
        makeRect({ id: "locked", locked: true }),
      ])

      const points = getAllSnapPoints(elements, new Set(["excluded"]))

      expect(points.every((p) => p.elementId === "visible")).toBe(true)
      expect(points).toHaveLength(6)
    })
  })

  describe("calculateSnap", () => {
    it("reports no snap when nothing is within threshold", () => {
      const points = getElementSnapPoints(makeRect({ id: "r" }))
      const result = calculateSnap({ x: 500, y: 500 }, points, 5)

      expect(result.snapped).toBe(false)
      expect(result.guides).toHaveLength(0)
    })

    it("produces vertical and horizontal guides near a snap point", () => {
      const points = getElementSnapPoints(
        makeRect({ height: 100, id: "r", width: 100, x: 0, y: 0 }),
      )
      const result = calculateSnap({ x: 1, y: 1 }, points, 5)

      expect(result.snapped).toBe(true)
      expect(result.guides.some((g) => g.type === "vertical")).toBe(true)
      expect(result.guides.some((g) => g.type === "horizontal")).toBe(true)
    })
  })

  describe("snapPointToGuides", () => {
    it("snaps the coordinate matching each guide axis", () => {
      const snapped = snapPointToGuides({ x: 3, y: 7 }, [
        { elements: [], position: 0, type: "vertical" },
        { elements: [], position: 10, type: "horizontal" },
      ])

      expect(snapped).toEqual({ x: 0, y: 10 })
    })

    it("returns the point unchanged with no guides", () => {
      expect(snapPointToGuides({ x: 4, y: 8 }, [])).toEqual({ x: 4, y: 8 })
    })
  })

  describe("snapBoundsToElements", () => {
    it("snaps the left edge to an aligned element", () => {
      const elements = toMap([
        makeRect({ height: 100, id: "target", width: 100, x: 100, y: 0 }),
      ])

      const result = snapBoundsToElements(
        { height: 50, width: 50, x: 102, y: 300 },
        elements,
        new Set(),
        5,
      )

      expect(result.x).toBe(100)
      expect(result.guides.some((g) => g.type === "vertical")).toBe(true)
    })

    it("snaps the right edge against a target right edge", () => {
      const elements = toMap([
        makeRect({ height: 100, id: "target", width: 100, x: 200, y: 0 }),
      ])

      const result = snapBoundsToElements(
        { height: 50, width: 50, x: 252, y: 500 },
        elements,
        new Set(),
        5,
      )

      // dragged right edge (252 + 50 = 302) snaps to target right edge (300)
      // -> x = 300 - 50 = 250
      expect(result.x).toBe(250)
    })

    it("does not snap when outside the threshold", () => {
      const elements = toMap([
        makeRect({ height: 100, id: "target", width: 100, x: 100, y: 0 }),
      ])

      const result = snapBoundsToElements(
        { height: 50, width: 50, x: 500, y: 500 },
        elements,
        new Set(),
        5,
      )

      expect(result.x).toBe(500)
      expect(result.y).toBe(500)
      expect(result.guides).toHaveLength(0)
    })

    it("excludes the dragged element from its own snap targets", () => {
      const elements = toMap([
        makeRect({ height: 100, id: "self", width: 100, x: 100, y: 0 }),
      ])

      const result = snapBoundsToElements(
        { height: 100, width: 100, x: 101, y: 0 },
        elements,
        new Set(["self"]),
        5,
      )

      expect(result.x).toBe(101)
      expect(result.guides).toHaveLength(0)
    })
  })
})
