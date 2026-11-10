import { GRID_COLOR, GRID_OPACITY } from "../../constants"
import type { CanvasEngine } from "../../engine/engine"
import { getGridStep } from "../../grid"
import type { DomState } from "../state"
import {
  gridGroupClass,
  gridLineClass,
  gridPatternClass,
  svgNamespaceURI,
} from "../svg"

let gridSequence = 0

/**
 * Build the grid layer and its pattern. The pattern lives in `<defs>` and is
 * referenced by a viewport-sized rect inside the transformed grid group.
 *
 * @internal
 */
export function createGridLayer(svg: SVGSVGElement): {
  group: SVGGElement
  pattern: SVGPatternElement
  patternLine: SVGPathElement
  rect: SVGRectElement
} {
  const defs = document.createElementNS(svgNamespaceURI, "defs")

  const pattern = document.createElementNS(svgNamespaceURI, "pattern")
  pattern.id = `adraw-grid-${++gridSequence}`
  pattern.classList.add(gridPatternClass)
  pattern.setAttribute("patternUnits", "userSpaceOnUse")

  const patternLine = document.createElementNS(svgNamespaceURI, "path")
  patternLine.classList.add(gridLineClass)
  patternLine.setAttribute("fill", "none")
  patternLine.setAttribute("stroke", GRID_COLOR)
  patternLine.setAttribute("opacity", GRID_OPACITY)
  patternLine.setAttribute("shape-rendering", "crispEdges")
  pattern.appendChild(patternLine)
  defs.appendChild(pattern)
  svg.appendChild(defs)

  const group = document.createElementNS(svgNamespaceURI, "g")
  group.classList.add(gridGroupClass)
  group.setAttribute("pointer-events", "none")

  const rect = document.createElementNS(svgNamespaceURI, "rect")
  rect.setAttribute("fill", `url(#${pattern.id})`)
  rect.setAttribute("pointer-events", "none")
  group.appendChild(rect)

  return { group, pattern, patternLine, rect }
}

/**
 * Paint the grid for the current viewport. The visible rect covers the world
 * bounds of the canvas while pattern tiles stay anchored to world coordinates,
 * so panning moves the grid with the content.
 *
 * @internal
 */
export function renderGrid(state: DomState, engine: CanvasEngine): void {
  const group = state.gridGroup
  const pattern = state.gridPattern
  const patternLine = state.gridPatternLine
  const rect = state.gridRect
  if (!group || !pattern || !patternLine || !rect) {
    return
  }

  const config = engine.getGridConfig()
  if (!config.enabled) {
    group.style.display = "none"
    return
  }
  group.style.display = ""

  const viewport = engine.getViewport()
  const canvasSize = engine.getCanvasSize()
  const zoom =
    viewport.zoom > 0 && Number.isFinite(viewport.zoom) ? viewport.zoom : 1
  const step = getGridStep(config.size, zoom)
  const width = canvasSize.width / zoom
  const height = canvasSize.height / zoom
  // Keep strokes one screen pixel wide as the viewport scales. Insetting the
  // lines by half a stroke keeps both edges fully inside the pattern tile
  // instead of clipping half their thickness at the tile boundary.
  const strokeWidth = 1 / zoom
  const halfStroke = strokeWidth / 2

  pattern.setAttribute("width", `${step}`)
  pattern.setAttribute("height", `${step}`)
  patternLine.setAttribute(
    "d",
    `M ${step} ${halfStroke} L ${halfStroke} ${halfStroke} L ${halfStroke} ${step}`,
  )
  patternLine.setAttribute("stroke-width", `${strokeWidth}`)

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    rect.setAttribute("width", "0")
    rect.setAttribute("height", "0")
    return
  }

  rect.setAttribute("x", `${viewport.x - width / 2}`)
  rect.setAttribute("y", `${viewport.y - height / 2}`)
  rect.setAttribute("width", `${width}`)
  rect.setAttribute("height", `${height}`)
}
