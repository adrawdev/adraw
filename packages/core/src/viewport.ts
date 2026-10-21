import { clamp } from "./coordinates"
import type { Point, ViewportState } from "./types"

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
}

/**
 * Default viewport configuration.
 */
const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  maxZoom: 10,
  minZoom: 0.1,
  zoomSensitivity: 0.001,
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
  const finalConfig = { ...DEFAULT_VIEWPORT_CONFIG, ...config }

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
  _config: ViewportConfig = DEFAULT_VIEWPORT_CONFIG,
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
 * @param config Viewport configuration.
 * @returns A new viewport state (or the unchanged viewport when clamped).
 */
export function zoomViewport(
  viewport: ViewportState,
  delta: number,
  centerPoint: Point,
  config: ViewportConfig = DEFAULT_VIEWPORT_CONFIG,
): ViewportState {
  const newZoom = clamp(
    viewport.zoom * (1 - delta * config.zoomSensitivity),
    config.minZoom,
    config.maxZoom,
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
 * @param bounds Content bounds to fit.
 * @param canvasSize Canvas container size in pixels.
 * @param padding Padding around the content in pixels.
 * @returns A new viewport state centered on the bounds.
 */
export function zoomToFit(
  viewport: ViewportState,
  bounds: { left: number; right: number; top: number; bottom: number },
  canvasSize: { width: number; height: number },
  padding: number = 50,
): ViewportState {
  const contentWidth = bounds.right - bounds.left
  const contentHeight = bounds.bottom - bounds.top

  if (contentWidth === 0 || contentHeight === 0) {
    return viewport
  }

  const availableWidth = canvasSize.width - padding * 2
  const availableHeight = canvasSize.height - padding * 2

  const scaleX = availableWidth / contentWidth
  const scaleY = availableHeight / contentHeight
  const newZoom = Math.min(scaleX, scaleY, DEFAULT_VIEWPORT_CONFIG.maxZoom)

  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2

  return {
    x: centerX,
    y: centerY,
    zoom: clamp(
      newZoom,
      DEFAULT_VIEWPORT_CONFIG.minZoom,
      DEFAULT_VIEWPORT_CONFIG.maxZoom,
    ),
  }
}

/**
 * Reset the viewport to origin with zoom 1.
 */
export function resetViewport(): ViewportState {
  return { x: 0, y: 0, zoom: 1 }
}
