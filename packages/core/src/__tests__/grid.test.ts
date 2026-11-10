import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { AdrawError } from "../errors"
import {
  createGridConfig,
  DEFAULT_GRID_CONFIG,
  getGridStep,
  snapBoundsToGrid,
  snapPointToGrid,
} from "../grid"

describe("grid configuration", () => {
  it("uses hidden, 20-unit, non-snapping defaults", () => {
    expect(DEFAULT_GRID_CONFIG).toEqual({
      enabled: false,
      size: 20,
      snap: false,
    })
    expect(createGridConfig()).toEqual(DEFAULT_GRID_CONFIG)
    expect(createGridConfig({ enabled: true, size: 32, snap: true })).toEqual({
      enabled: true,
      size: 32,
      snap: true,
    })
  })

  it("ignores undefined fields and validates the merged result", () => {
    expect(
      createGridConfig({ enabled: undefined, size: 40, snap: undefined }),
    ).toEqual({ enabled: false, size: 40, snap: false })

    expect(() => createGridConfig({ size: 0 })).toThrowError(AdrawError)
    expect(() => createGridConfig({ size: -1 })).toThrowError(AdrawError)
    expect(() => createGridConfig({ size: Number.NaN })).toThrowError(
      AdrawError,
    )
    expect(() => createGridConfig({ size: Number.POSITIVE_INFINITY })).toThrow(
      /finite number greater than zero/,
    )
  })

  it("validates the constructor option", () => {
    expect(() => new AdrawCanvas({ grid: { size: 0 } })).toThrowError(
      AdrawError,
    )
  })

  it("is configurable at runtime through the engine", () => {
    const canvas = new AdrawCanvas()
    expect(canvas.getGridConfig()).toEqual(DEFAULT_GRID_CONFIG)

    canvas.setGridConfig({ enabled: true, size: 32, snap: true })
    expect(canvas.getGridConfig()).toEqual({
      enabled: true,
      size: 32,
      snap: true,
    })

    canvas.setGridConfig({ snap: false })
    canvas.setGridConfig({ size: undefined })
    expect(canvas.getGridConfig()).toEqual({
      enabled: true,
      size: 32,
      snap: false,
    })

    expect(() => canvas.setGridConfig({ size: 0 })).toThrowError(AdrawError)
    expect(canvas.getGridConfig()).toEqual({
      enabled: true,
      size: 32,
      snap: false,
    })
  })
})

describe("grid geometry", () => {
  it("doubles the visual step until lines are at least 8 screen pixels apart", () => {
    expect(getGridStep(20, 1)).toBe(20)
    expect(getGridStep(20, 0.5)).toBe(20)
    expect(getGridStep(20, 0.2)).toBe(40)
    expect(getGridStep(20, 0.1)).toBe(80)
    expect(getGridStep(20, 0.01)).toBe(1280)
  })

  it("falls back to a safe zoom for invalid values", () => {
    expect(getGridStep(20, 0)).toBe(20)
    expect(getGridStep(20, Number.NaN)).toBe(20)
    expect(getGridStep(0.5, 1)).toBe(8)
  })

  it("snaps points to the nearest intersection, including negatives", () => {
    expect(snapPointToGrid({ x: 13, y: 27 }, 20)).toEqual({ x: 20, y: 20 })
    expect(snapPointToGrid({ x: -13, y: -27 }, 20)).toEqual({ x: -20, y: -20 })
    expect(snapPointToGrid({ x: 29.9, y: 30.1 }, 20)).toEqual({ x: 20, y: 40 })
  })

  it("snaps bounds by their top-left corner without changing size", () => {
    expect(
      snapBoundsToGrid({ height: 12, width: 42, x: 13, y: 27 }, 20),
    ).toEqual({ height: 12, width: 42, x: 20, y: 20 })
  })
})
