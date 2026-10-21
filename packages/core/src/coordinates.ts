import type { Point, Size, ViewportState } from "./types"

/**
 * Convert a screen-space point into canvas-space coordinates.
 *
 * @param screenPoint Point in screen pixels.
 * @param viewport Current viewport state.
 * @param canvasSize Size of the canvas container in pixels.
 * @returns The same point expressed in canvas coordinates.
 */
export function screenToCanvas(
  screenPoint: Point,
  viewport: ViewportState,
  canvasSize: Size,
): Point {
  const centerX = canvasSize.width / 2
  const centerY = canvasSize.height / 2

  const x = (screenPoint.x - centerX) / viewport.zoom + viewport.x
  const y = (screenPoint.y - centerY) / viewport.zoom + viewport.y

  return { x, y }
}

/**
 * Convert a canvas-space point into screen-space coordinates.
 *
 * @param canvasPoint Point in canvas coordinates.
 * @param viewport Current viewport state.
 * @param canvasSize Size of the canvas container in pixels.
 * @returns The same point expressed in screen (container) pixels.
 */
export function canvasToScreen(
  canvasPoint: Point,
  viewport: ViewportState,
  canvasSize: Size,
): Point {
  const centerX = canvasSize.width / 2
  const centerY = canvasSize.height / 2

  const x = (canvasPoint.x - viewport.x) * viewport.zoom + centerX
  const y = (canvasPoint.y - viewport.y) * viewport.zoom + centerY

  return { x, y }
}

/**
 * Get the axis-aligned bounds of an (optionally rotated) rectangle.
 *
 * @param x Top-left x.
 * @param y Top-left y.
 * @param width Width.
 * @param height Height.
 * @param rotation Rotation in degrees (default 0).
 * @returns Bounds with `left/right/top/bottom` and `center`.
 * @example
 * ```ts
 * const bounds = getElementBounds(0, 0, 100, 50, 45)
 * ```
 */
export function getElementBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number = 0,
): { left: number; right: number; top: number; bottom: number; center: Point } {
  if (rotation === 0) {
    return {
      bottom: y + height,
      center: { x: x + width / 2, y: y + height / 2 },
      left: x,
      right: x + width,
      top: y,
    }
  }

  const cx = x + width / 2
  const cy = y + height / 2
  const rad = (rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]

  const rotatedCorners = corners.map((corner) => {
    const dx = corner.x - width / 2
    const dy = corner.y - height / 2
    return {
      x: cos * dx - sin * dy + cx,
      y: sin * dx + cos * dy + cy,
    }
  })

  const xs = rotatedCorners.map((c) => c.x)
  const ys = rotatedCorners.map((c) => c.y)

  return {
    bottom: Math.max(...ys),
    center: { x: cx, y: cy },
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
  }
}

/**
 * Test whether a point lies inside a set of left/right/top/bottom bounds.
 */
export function pointInBounds(
  point: Point,
  bounds: { left: number; right: number; top: number; bottom: number },
): boolean {
  return (
    point.x >= bounds.left &&
    point.x <= bounds.right &&
    point.y >= bounds.top &&
    point.y <= bounds.bottom
  )
}

/**
 * Euclidean distance between two points.
 */
export function distanceBetweenPoints(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Clamp a number to the inclusive range `[min, max]`.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Generate a unique element id string.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
