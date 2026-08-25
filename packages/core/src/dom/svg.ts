import { FILL_COLOR, STROKE_COLOR, STROKE_WIDTH } from "../constants"
import { DEFAULT_PATH_SMOOTHING } from "../elements"
import type { CanvasElement, Point, TextElement } from "../types"

export const svgNamespaceURI = "http://www.w3.org/2000/svg"
export const elementsGroupClass = "adraw-elements-group"
export const elementClass = "adraw-element"
export const temporaryClass = "adraw-temporary"
export const guidesGroupClass = "adraw-guides-group"
export const selectedClass = "adraw-selected"
export const transformOverlayClass = "adraw-transform-overlay"
export const rotationHandleClass = "adraw-rotation-handle"
export const resizeHandleClass = "adraw-resize-handle"
export const resizeEdgeClass = "adraw-resize-edge"
export const selectionBoxClass = "adraw-selection-box"
export const textEditorClass = "adraw-text-editor"

export const boundingBoxStrokeWidth = 2
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
  // rotate about their absolute bbox center. Lines never use rotate() — their
  // visual rotation comes purely from changed endpoint coordinates. Other
  // elements are translated to (x, y) first, so their pivot is the local center
  // (width/2, height/2).
  if (element.type === "line") {
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

export function createElementGroup(element: CanvasElement): SVGGElement {
  const group = document.createElementNS(svgNamespaceURI, "g")
  group.id = element.id
  group.setAttribute("transform", getTransformElementAttribute(element))

  switch (element.type) {
    case "rectangle": {
      const rect = document.createElementNS(svgNamespaceURI, "rect")
      rect.setAttribute("width", `${element.width}`)
      rect.setAttribute("height", `${element.height}`)
      rect.setAttribute("rx", `${element.cornerRadius}`)
      rect.setAttribute("fill", FILL_COLOR)
      rect.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      rect.setAttribute("stroke-width", `${STROKE_WIDTH}`)
      group.appendChild(rect)
      break
    }

    case "ellipse": {
      const ellipse = document.createElementNS(svgNamespaceURI, "ellipse")
      ellipse.setAttribute("cx", `${element.width / 2}`)
      ellipse.setAttribute("cy", `${element.height / 2}`)
      ellipse.setAttribute("rx", `${element.width / 2}`)
      ellipse.setAttribute("ry", `${element.height / 2}`)
      ellipse.setAttribute("fill", FILL_COLOR)
      ellipse.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      ellipse.setAttribute("stroke-width", `${STROKE_WIDTH}`)
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
      text.setAttribute("font-family", "system-ui, sans-serif")
      text.setAttribute("font-size", `${element.fontSize}`)
      text.setAttribute("fill", element.strokeColor || STROKE_COLOR)
      text.style.userSelect = "none"
      text.style.whiteSpace = "pre"
      appendTextLines(text, element)
      group.appendChild(text)
      break
    }
  }

  return group
}

// One tspan per line: SVG text does not lay out "\n" itself, and a tspan per
// line with a fixed dy also gives the exact line spacing used by
// `measureTextSize` (1.2em). `dominant-baseline: hanging` on the parent makes
// the element's (x, y) the top-left of the first line, matching the bbox.
export function appendTextLines(
  text: SVGTextElement,
  element: TextElement,
): void {
  element.text.split("\n").forEach((line, i) => {
    const tspan = document.createElementNS(svgNamespaceURI, "tspan")
    tspan.setAttribute("x", "0")
    tspan.setAttribute("dy", i === 0 ? "0" : `${element.fontSize * 1.2}`)
    tspan.textContent = line
    text.appendChild(tspan)
  })
}
