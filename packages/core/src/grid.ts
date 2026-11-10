import { AdrawError } from "./errors"
import type { Point } from "./types"

/**
 * Grid visibility and snapping configuration.
 */
export interface GridConfig {
  /** Show the grid in the DOM adapter. */
  enabled: boolean
  /** Grid spacing in canvas units. */
  size: number
  /** Snap creation, move and resize gestures to the grid. */
  snap: boolean
}

/**
 * Built-in grid defaults: hidden, 20 canvas units, snapping off.
 */
export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: false,
  size: 20,
  snap: false,
}

const GRID_MIN_SCREEN_SPACING = 8

/**
 * Merge a partial grid configuration over the defaults and validate it.
 *
 * @param partial Partial configuration. `undefined` fields are ignored.
 * @returns A complete grid configuration.
 * @throws {AdrawError} `invalid-option` when `size` is not a finite number
 * greater than zero or the booleans are not booleans.
 */
export function createGridConfig(
  partial: Partial<GridConfig> = {},
): GridConfig {
  const entries = Object.entries(partial).filter(
    ([, value]) => value !== undefined,
  )
  const config = {
    ...DEFAULT_GRID_CONFIG,
    ...Object.fromEntries(entries),
  } as GridConfig

  if (typeof config.enabled !== "boolean") {
    throw new AdrawError("invalid-option", "grid: enabled must be a boolean", {
      details: { option: "enabled", value: config.enabled },
    })
  }
  if (typeof config.snap !== "boolean") {
    throw new AdrawError("invalid-option", "grid: snap must be a boolean", {
      details: { option: "snap", value: config.snap },
    })
  }
  if (
    typeof config.size !== "number" ||
    !Number.isFinite(config.size) ||
    config.size <= 0
  ) {
    throw new AdrawError(
      "invalid-option",
      "grid: size must be a finite number greater than zero",
      { details: { option: "size", value: config.size } },
    )
  }

  return config
}

/**
 * Visual grid step for a zoom level. The base size is doubled until lines are
 * at least {@link GRID_MIN_SCREEN_SPACING} screen pixels apart.
 *
 * @internal
 */
export function getGridStep(size: number, zoom: number): number {
  let step = Number.isFinite(size) && size > 0 ? size : 1
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  while (step * safeZoom < GRID_MIN_SCREEN_SPACING) {
    step *= 2
  }
  return step
}

/**
 * Snap a point to the nearest grid intersection.
 *
 * @internal
 */
export function snapPointToGrid(point: Point, size: number): Point {
  const step = Number.isFinite(size) && size > 0 ? size : 1
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
  }
}

/**
 * Snap the top-left corner of bounds to the grid, preserving its size.
 *
 * @internal
 */
export function snapBoundsToGrid(
  bounds: { height: number; width: number; x: number; y: number },
  size: number,
): { height: number; width: number; x: number; y: number } {
  const point = snapPointToGrid({ x: bounds.x, y: bounds.y }, size)
  return { height: bounds.height, width: bounds.width, x: point.x, y: point.y }
}
