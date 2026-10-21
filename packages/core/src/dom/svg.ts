import {
  FILL_COLOR,
  STROKE_COLOR,
  STROKE_WIDTH,
  TEXT_FONT_FAMILY,
} from "../constants"
import { DEFAULT_PATH_SMOOTHING } from "../elements"
import {
  approximateTextMeasurer,
  getTextAnchor,
  getTextLeading,
  getTextLineHeightPx,
  getTextLines,
  getTextLineX,
  type TextMeasurer,
} from "../text"
import type {
  ArrowElement,
  BoundingBox,
  CanvasElement,
  Point,
  TextElement,
} from "../types"

export const svgNamespaceURI = "http://www.w3.org/2000/svg"
export const elementsGroupClass = "adraw-elements-group"
export const elementClass = "adraw-element"
export const temporaryClass = "adraw-temporary"
export const guidesGroupClass = "adraw-guides-group"
export const selectedClass = "adraw-selected"
export const bindingTargetClass = "adraw-binding-target"
export const transformOverlayClass = "adraw-transform-overlay"
export const rotationHandleClass = "adraw-rotation-handle"
export const resizeHandleClass = "adraw-resize-handle"
export const resizeEdgeClass = "adraw-resize-edge"
export const selectionBoxClass = "adraw-selection-box"
export const multiSelectionBoxClass = "adraw-multi-selection-box"
export const snapGuideClass = "adraw-snap-guide"
export const textEditorClass = "adraw-text-editor"

export const boundingBoxStrokeWidth = 2
export const snapGuideStrokeWidth = 1
export const resizeHandleSize = 12
export const rotationHandleRadio = 6
export const rotationHandleSpacing = 30

// Cursor for each resize/rotation handle, keyed by its `data-anchor` value.
export const handleCursorMap: Record<string, string> = {
  "bottom-center": "s-resize",
  "bottom-left": "sw-resize",
  "bottom-right": "se-resize",
  "left-center": "w-resize",
  "right-center": "e-resize",
  rotation: "crosshair",
  "top-center": "n-resize",
  "top-left": "nw-resize",
  "top-right": "ne-resize",
}

export function getTransformElementAttribute(element: CanvasElement) {
  // Paths are drawn from absolute coordinates (no translate), so they must
  // rotate about their absolute bbox center. Lines and arrows never use
  // rotate() — their visual rotation comes purely from changed endpoint
  // coordinates. Other elements are translated to (x, y) first, so their pivot
  // is the local center (width/2, height/2).
  if (element.type === "line" || element.type === "arrow") {
    return ""
  }
  if (element.type === "path") {
    const cx = element.x + element.width / 2
    const cy = element.y + element.height / 2
    return `rotate(${element.rotation}, ${cx}, ${cy})`
  }
  const translate = `translate(${element.x}, ${element.y})`
  const rotate = `rotate(${element.rotation}, ${element.width / 2}, ${element.height / 2})`
  return `${translate} ${rotate}`
}

// Render the path through every point with a Cardinal/Catmull-Rom spline
// expressed as cubic Béziers. This yields a smooth curve that still
// interpolates each point, unlike straight line segments which look jagged for
// freehand strokes. `tension` scales the control-point tangents: 0 collapses to
// straight segments, 1 gives a full Catmull-Rom curve.
export function pointsToPath(
  points: Point[],
  tension = DEFAULT_PATH_SMOOTHING,
): string {
  if (points.length === 0) {
    return ""
  }

  let d = `M ${points[0].x} ${points[0].y}`

  if (points.length < 3 || tension <= 0) {
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`
    }
    return d
  }

  // Catmull-Rom tangents are (p2 - p0) / 2 scaled to thirds for the Bézier
  // control points, i.e. /6. Folding tension in gives tension / 6.
  const k = tension / 6

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1]

    const cp1x = p1.x + (p2.x - p0.x) * k
    const cp1y = p1.y + (p2.y - p0.y) * k
    const cp2x = p2.x - (p3.x - p1.x) * k
    const cp2y = p2.y - (p3.y - p1.y) * k

    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }

  return d
}

// Filled-triangle arrowhead sized relative to the stroke width (with a floor so
// thin strokes stay legible). The stroke is trimmed at the head base so the
// line never pokes through the tip.
const arrowHeadLengthRatio = 5
const arrowHeadMinLength = 10
const arrowHeadHalfWidthRatio = 0.4

export function getArrowHeadLength(strokeWidth: number): number {
  return Math.max(
    arrowHeadMinLength,
    arrowHeadLengthRatio * (strokeWidth || STROKE_WIDTH),
  )
}

// Half of the arrowhead's base width, i.e. how far the head extends
// perpendicular to the arrow line. Used to pad the exported region so heads
// are not clipped.
export function getArrowHeadHalfWidth(strokeWidth: number): number {
  return getArrowHeadLength(strokeWidth) * arrowHeadHalfWidthRatio
}

interface ArrowSvgGeometry {
  startHead: string | null
  endHead: string | null
  lineStart: Point
  lineEnd: Point
  // Segment of the shaft hidden under a bound label, if any.
  gapStart: Point | null
  gapEnd: Point | null
}

// Extra room around a label so the shaft does not touch the glyphs.
const arrowLabelGap = 4

// Liang–Barsky clipping: parameter interval of segment `start → end` that lies
// inside an axis-aligned rectangle, or null when it misses.
function clipSegmentToRect(
  start: Point,
  end: Point,
  rect: { bottom: number; left: number; right: number; top: number },
): { t0: number; t1: number } | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const p = [-dx, dx, -dy, dy]
  const q = [
    start.x - rect.left,
    rect.right - start.x,
    start.y - rect.top,
    rect.bottom - start.y,
  ]
  let t0 = 0
  let t1 = 1

  for (let i = 0; i < 4; i++) {
    const pi = p[i]
    const qi = q[i]
    if (pi === 0) {
      if (qi < 0) {
        return null
      }
      continue
    }
    const r = qi / pi
    if (pi < 0) {
      if (r > t1) {
        return null
      }
      if (r > t0) {
        t0 = r
      }
    } else {
      if (r < t0) {
        return null
      }
      if (r < t1) {
        t1 = r
      }
    }
  }

  return t0 < t1 ? { t0, t1 } : null
}

export function getArrowSvgGeometry(
  element: ArrowElement,
  labelBox: BoundingBox | null = null,
): ArrowSvgGeometry {
  const start = { x: element.startX, y: element.startY }
  const end = { x: element.endX, y: element.endY }
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const dir =
    length > 0
      ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length }
      : { x: 1, y: 0 }

  const headLength = getArrowHeadLength(element.strokeWidth)
  const trim = Math.min(headLength, length)
  let lineStart = element.startArrowhead
    ? { x: start.x + dir.x * trim, y: start.y + dir.y * trim }
    : start
  let lineEnd = element.endArrowhead
    ? { x: end.x - dir.x * trim, y: end.y - dir.y * trim }
    : end

  // Both heads enabled on a very short arrow would invert the trimmed segment;
  // fall back to the full span so it still draws.
  const span =
    (lineEnd.x - lineStart.x) * dir.x + (lineEnd.y - lineStart.y) * dir.y
  if (span < 0) {
    lineStart = start
    lineEnd = end
  }

  let gapStart: Point | null = null
  let gapEnd: Point | null = null
  if (labelBox) {
    const clip = clipSegmentToRect(lineStart, lineEnd, {
      bottom: labelBox.y + labelBox.height + arrowLabelGap,
      left: labelBox.x - arrowLabelGap,
      right: labelBox.x + labelBox.width + arrowLabelGap,
      top: labelBox.y - arrowLabelGap,
    })
    if (clip) {
      gapStart = {
        x: lineStart.x + (lineEnd.x - lineStart.x) * clip.t0,
        y: lineStart.y + (lineEnd.y - lineStart.y) * clip.t0,
      }
      gapEnd = {
        x: lineStart.x + (lineEnd.x - lineStart.x) * clip.t1,
        y: lineStart.y + (lineEnd.y - lineStart.y) * clip.t1,
      }
    }
  }

  return {
    endHead: element.endArrowhead ? arrowHeadPath(end, dir, headLength) : null,
    gapEnd,
    gapStart,
    lineEnd,
    lineStart,
    startHead: element.startArrowhead
      ? arrowHeadPath(start, { x: -dir.x, y: -dir.y }, headLength)
      : null,
  }
}

function arrowHeadPath(tip: Point, dir: Point, headLength: number): string {
  const base = { x: tip.x - dir.x * headLength, y: tip.y - dir.y * headLength }
  const halfWidth = headLength * arrowHeadHalfWidthRatio
  const normal = { x: -dir.y, y: dir.x }
  const a = {
    x: base.x + normal.x * halfWidth,
    y: base.y + normal.y * halfWidth,
  }
  const b = {
    x: base.x - normal.x * halfWidth,
    y: base.y - normal.y * halfWidth,
  }
  return `M ${tip.x} ${tip.y} L ${a.x} ${a.y} L ${b.x} ${b.y} Z`
}

/**
 * Mirror an element's `opacity` onto its SVG group. Omitted or fully opaque
 * elements get no attribute so the common case stays clean.
 */
export function applyElementOpacity(
  group: SVGGElement,
  element: CanvasElement,
): void {
  if (element.opacity === undefined || element.opacity === 1) {
    group.removeAttribute("opacity")
  } else {
    group.setAttribute("opacity", `${element.opacity}`)
  }
}

/**
 * Write one arrow shaft segment. Zero-length segments are hidden so a label's
 * gap does not leave a round-cap dot behind.
 */
export function applyArrowShaft(
  line: SVGLineElement,
  start: Point,
  end: Point,
  stroke: string,
  strokeWidth: number,
): void {
  line.setAttribute("stroke-linecap", "round")
  line.setAttribute("stroke-linejoin", "round")
  line.setAttribute("x1", `${start.x}`)
  line.setAttribute("y1", `${start.y}`)
  line.setAttribute("x2", `${end.x}`)
  line.setAttribute("y2", `${end.y}`)
  line.setAttribute("stroke", stroke)
  line.setAttribute("stroke-width", `${strokeWidth}`)
  if (Math.hypot(end.x - start.x, end.y - start.y) < 0.01) {
    line.setAttribute("display", "none")
  } else {
    line.removeAttribute("display")
  }
}

/**
 * Build the SVG group for one canvas element.
 *
 * @param element Element to render.
 * @param textMeasurer Measurer used for text elements.
 * @param arrowLabelBox Bounds of an arrow's bound label. When present, the
 * shaft is split to leave a gap under the label.
 * @returns The element's `<g>` node.
 */
export function createElementGroup(
  element: CanvasElement,
  textMeasurer: TextMeasurer = approximateTextMeasurer,
  arrowLabelBox: BoundingBox | null = null,
): SVGGElement {
  const group = document.createElementNS(svgNamespaceURI, "g")
  group.id = element.id
  group.setAttribute("transform", getTransformElementAttribute(element))
  applyElementOpacity(group, element)

  switch (element.type) {
    case "rectangle": {
      const rect = document.createElementNS(svgNamespaceURI, "rect")
      rect.setAttribute("width", `${element.width}`)
      rect.setAttribute("height", `${element.height}`)
      rect.setAttribute("rx", `${element.cornerRadius}`)
      rect.setAttribute("ry", `${element.cornerRadius}`)
      rect.setAttribute("fill", element.fillColor || FILL_COLOR)
      rect.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      rect.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      group.appendChild(rect)
      break
    }

    case "ellipse": {
      const ellipse = document.createElementNS(svgNamespaceURI, "ellipse")
      ellipse.setAttribute("cx", `${element.width / 2}`)
      ellipse.setAttribute("cy", `${element.height / 2}`)
      ellipse.setAttribute("rx", `${element.width / 2}`)
      ellipse.setAttribute("ry", `${element.height / 2}`)
      ellipse.setAttribute("fill", element.fillColor || FILL_COLOR)
      ellipse.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      ellipse.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      group.appendChild(ellipse)
      break
    }

    case "line": {
      const line = document.createElementNS(svgNamespaceURI, "line")
      line.setAttribute("stroke-linecap", "round")
      line.setAttribute("stroke-linejoin", "round")
      line.setAttribute("x1", `${element.startX}`)
      line.setAttribute("y1", `${element.startY}`)
      line.setAttribute("x2", `${element.endX}`)
      line.setAttribute("y2", `${element.endY}`)
      line.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      line.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      group.appendChild(line)
      break
    }

    case "arrow": {
      const geometry = getArrowSvgGeometry(element, arrowLabelBox)
      const stroke = element.strokeColor || STROKE_COLOR
      const strokeWidth = element.strokeWidth || STROKE_WIDTH

      const line = document.createElementNS(svgNamespaceURI, "line")
      applyArrowShaft(
        line,
        geometry.lineStart,
        geometry.gapStart ?? geometry.lineEnd,
        stroke,
        strokeWidth,
      )
      group.appendChild(line)

      // The shaft resumes after the label. With no label this segment is
      // zero-length and hidden.
      const tail = document.createElementNS(svgNamespaceURI, "line")
      applyArrowShaft(
        tail,
        geometry.gapEnd ?? geometry.lineEnd,
        geometry.lineEnd,
        stroke,
        strokeWidth,
      )
      group.appendChild(tail)

      for (const d of [geometry.endHead, geometry.startHead]) {
        const head = document.createElementNS(svgNamespaceURI, "path")
        head.setAttribute("fill", stroke)
        head.setAttribute("stroke", "none")
        if (d) {
          head.setAttribute("d", d)
        } else {
          head.setAttribute("display", "none")
        }
        group.appendChild(head)
      }
      break
    }

    case "path": {
      const pathData = pointsToPath(element.points, element.smoothing)
      const path = document.createElementNS(svgNamespaceURI, "path")
      path.setAttribute("stroke-linecap", "round")
      path.setAttribute("stroke-linejoin", "round")
      path.setAttribute("d", pathData)
      path.setAttribute("fill", "none")
      path.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      path.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      group.appendChild(path)
      break
    }

    case "media": {
      const image = document.createElementNS(svgNamespaceURI, "image")
      image.setAttribute("href", element.src)
      image.setAttribute("width", `${element.width}`)
      image.setAttribute("height", `${element.height}`)
      image.setAttribute("preserveAspectRatio", "none")
      group.appendChild(image)
      break
    }

    case "text": {
      const text = document.createElementNS(svgNamespaceURI, "text")
      text.setAttribute("dominant-baseline", "hanging")
      applyTextAttributes(text, element)
      text.style.whiteSpace = "pre"
      text.style.userSelect = "none"
      // WebKit does not apply (or serialize) `style.userSelect` on SVG text;
      // only the prefixed property prevents selection there.
      text.style.setProperty("-webkit-user-select", "none")
      appendTextLines(text, element, textMeasurer)
      group.appendChild(text)
      break
    }
  }

  return group
}

/**
 * Write the font family, size, color and alignment attributes shared by initial
 * text creation and in-place updates.
 */
export function applyTextAttributes(
  text: SVGTextElement,
  element: TextElement,
): void {
  text.setAttribute("font-family", element.fontFamily || TEXT_FONT_FAMILY)
  text.setAttribute("font-size", `${element.fontSize}`)
  text.setAttribute("fill", element.strokeColor || STROKE_COLOR)
  text.setAttribute("text-anchor", getTextAnchor(element))
}

/**
 * Append one `<tspan>` per line. `dominant-baseline: hanging` makes each
 * tspan's `y` the top of its line box, and the half-leading above the first
 * line matches how the HTML editor overlay positions text inside `lineHeight`.
 */
export function appendTextLines(
  text: SVGTextElement,
  element: TextElement,
  measurer: TextMeasurer = approximateTextMeasurer,
): void {
  const lineHeight = getTextLineHeightPx(element)
  const leading = getTextLeading(element)
  const x = getTextLineX(element)

  getTextLines(element, measurer).forEach((line, i) => {
    const tspan = document.createElementNS(svgNamespaceURI, "tspan")
    tspan.setAttribute("x", `${x}`)
    tspan.setAttribute("y", `${leading + i * lineHeight}`)
    tspan.textContent = line
    text.appendChild(tspan)
  })
}
