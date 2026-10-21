import { clamp } from "./coordinates"
import type { Point, ViewportState } from "./types"

/**
 * Bounds accepted by viewport fit helpers.
 *
 * Both element-style (`x`/`y`/`width`/`height`) and edge-style
 * (`left`/`right`/`top`/`bottom`) shapes are supported, so callers can pass an
 * element rectangle or the result of `getElementsBounds` without converting it
 * first.
 */
export type ViewportBounds =
  | { x: number; y: number; width: number; height: number }
  | { left: number; right: number; top: number; bottom: number }

/**
 * Options accepted by the engine's `zoomToFit`.
 */
export interface ZoomToFitOptions {
  /** Explicit bounds to fit; defaults to the bounds of all visible elements. */
  bounds?: ViewportBounds
  /** Padding around the content in screen pixels; defaults to `fitPadding`. */
  padding?: number
}

/**
 * Configuration for viewport zoom/pan behavior.
 */
export interface ViewportConfig {
  /** Minimum allowed zoom. */
  minZoom: number
  /** Maximum allowed zoom. */
  maxZoom: number
  /** Zoom sensitivity factor applied to wheel deltas. */
  zoomSensitivity: number
  /** Padding kept around content when fitting it, in screen pixels. */
  fitPadding: number
  /**
   * Keep content in view: pan is clamped to the content bounds and zoom cannot
   * go below the zoom of the last successful fit.
   */
  constrainToContent: boolean
}

/**
 * Default viewport configuration.
 */
export const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  constrainToContent: false,
  fitPadding: 32,
  maxZoom: 10,
  minZoom: 0.1,
  zoomSensitivity: 0.001,
}

/**
 * Resolve a partial viewport configuration against the defaults.
 *
 * @param config Partial viewport configuration.
 * @returns A fully resolved configuration with a valid zoom range.
 */
export function resolveViewportConfig(
  config: Partial<ViewportConfig> = {},
): ViewportConfig {
  const minZoom = Math.max(
    Number.EPSILON,
    config.minZoom ?? DEFAULT_VIEWPORT_CONFIG.minZoom,
  )

  return {
    constrainToContent:
      config.constrainToContent ?? DEFAULT_VIEWPORT_CONFIG.constrainToContent,
    fitPadding: Math.max(
      0,
      config.fitPadding ?? DEFAULT_VIEWPORT_CONFIG.fitPadding,
    ),
    maxZoom: Math.max(
      minZoom,
      config.maxZoom ?? DEFAULT_VIEWPORT_CONFIG.maxZoom,
    ),
    minZoom,
    zoomSensitivity:
      config.zoomSensitivity ?? DEFAULT_VIEWPORT_CONFIG.zoomSensitivity,
  }
}

/**
 * Normalize element-style or edge-style bounds to edge-style bounds.
 *
 * @param bounds Bounds in either supported shape.
 * @returns Bounds with `left`/`right`/`top`/`bottom`.
 */
export function normalizeViewportBounds(bounds: ViewportBounds): {
  bottom: number
  left: number
  right: number
  top: number
} {
  if ("left" in bounds) {
    return bounds
  }

  return {
    bottom: bounds.y + bounds.height,
    left: bounds.x,
    right: bounds.x + bounds.width,
    top: bounds.y,
  }
}

/**
 * Create a (possibly clamped) initial viewport.
 *
 * @param initialViewport Starting viewport state; defaults to origin/zoom 1.
 * @param config Partial viewport configuration.
 * @returns A viewport state with zoom clamped to the configured range.
 */
export function createViewport(
  initialViewport: ViewportState = { x: 0, y: 0, zoom: 1 },
  config: Partial<ViewportConfig> = {},
): ViewportState {
  const finalConfig = resolveViewportConfig(config)

  return {
    ...initialViewport,
    zoom: clamp(initialViewport.zoom, finalConfig.minZoom, finalConfig.maxZoom),
  }
}

/**
 * Pan a viewport by the given delta.
 *
 * @param viewport Current viewport.
 * @param delta Pan delta in canvas units.
 * @param _config Unused, kept for signature compatibility.
 * @returns A new viewport state.
 */
export function panViewport(
  viewport: ViewportState,
  delta: Point,
  _config: Partial<ViewportConfig> = {},
): ViewportState {
  return {
    ...viewport,
    x: viewport.x + delta.x,
    y: viewport.y + delta.y,
  }
}

/**
 * Zoom a viewport around a center point.
 *
 * @param viewport Current viewport.
 * @param delta Wheel/zoom delta (positive zooms out, negative zooms in).
 * @param centerPoint Point in canvas coordinates to zoom around.
 * @param config Partial viewport configuration.
 * @returns A new viewport state (or the unchanged viewport when clamped).
 */
export function zoomViewport(
  viewport: ViewportState,
  delta: number,
  centerPoint: Point,
  config: Partial<ViewportConfig> = {},
): ViewportState {
  const finalConfig = resolveViewportConfig(config)
  const newZoom = clamp(
    viewport.zoom * (1 - delta * finalConfig.zoomSensitivity),
    finalConfig.minZoom,
    finalConfig.maxZoom,
  )

  if (newZoom === viewport.zoom) {
    return viewport
  }

  const zoomRatio = newZoom / viewport.zoom

  return {
    x: centerPoint.x - (centerPoint.x - viewport.x) * zoomRatio,
    y: centerPoint.y - (centerPoint.y - viewport.y) * zoomRatio,
    zoom: newZoom,
  }
}

/**
 * Compute a viewport that fits the given bounds within the canvas size.
 *
 * @param viewport Fallback viewport when bounds are empty.
 * @param bounds Content bounds to fit (element-style or edge-style).
 * @param canvasSize Canvas container size in pixels.
 * @param padding Padding around the content in pixels.
 * @param config Partial viewport configuration.
 * @returns A new viewport state centered on the bounds.
 */
export function zoomToFit(
  viewport: ViewportState,
  bounds: ViewportBounds,
  canvasSize: { width: number; height: number },
  padding: number = DEFAULT_VIEWPORT_CONFIG.fitPadding,
  config: Partial<ViewportConfig> = {},
): ViewportState {
  const finalConfig = resolveViewportConfig(config)
  const { bottom, left, right, top } = normalizeViewportBounds(bounds)
  const contentWidth = right - left
  const contentHeight = bottom - top

  if (contentWidth <= 0 || contentHeight <= 0) {
    return viewport
  }

  const availableWidth = Math.max(1, canvasSize.width - padding * 2)
  const availableHeight = Math.max(1, canvasSize.height - padding * 2)

  const scaleX = availableWidth / contentWidth
  const scaleY = availableHeight / contentHeight
  const newZoom = Math.min(scaleX, scaleY, finalConfig.maxZoom)

  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  return {
    x: centerX,
    y: centerY,
    zoom: clamp(newZoom, finalConfig.minZoom, finalConfig.maxZoom),
  }
}

/**
 * Clamp a viewport so content stays in view.
 *
 * When the content fits inside the viewport on an axis it is centered on that
 * axis; otherwise the viewport is kept inside the content so panning cannot
 * reveal empty space beyond the content edges.
 *
 * @param viewport Viewport to constrain.
 * @param bounds Content bounds.
 * @param canvasSize Canvas container size in pixels.
 * @returns The constrained viewport (a new object, or the input when it cannot
 * be constrained yet).
 */
export function constrainViewportToBounds(
  viewport: ViewportState,
  bounds: ViewportBounds,
  canvasSize: { width: number; height: number },
): ViewportState {
  if (
    !(viewport.zoom > 0) ||
    !(canvasSize.width > 0) ||
    !(canvasSize.height > 0)
  ) {
    return viewport
  }

  const { bottom, left, right, top } = normalizeViewportBounds(bounds)
  const contentWidth = right - left
  const contentHeight = bottom - top

  if (contentWidth <= 0 && contentHeight <= 0) {
    return viewport
  }

  const halfViewWidth = canvasSize.width / 2 / viewport.zoom
  const halfViewHeight = canvasSize.height / 2 / viewport.zoom
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  const x =
    contentWidth <= halfViewWidth * 2
      ? centerX
      : clamp(viewport.x, left + halfViewWidth, right - halfViewWidth)
  const y =
    contentHeight <= halfViewHeight * 2
      ? centerY
      : clamp(viewport.y, top + halfViewHeight, bottom - halfViewHeight)

  if (x === viewport.x && y === viewport.y) {
    return viewport
  }

  return { ...viewport, x, y }
}

/**
 * Reset the viewport to origin with zoom 1.
 */
export function resetViewport(): ViewportState {
  return { x: 0, y: 0, zoom: 1 }
}
