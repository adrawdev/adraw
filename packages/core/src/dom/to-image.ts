import { BACKGROUND_COLOR } from "../constants"
import { getElementBounds } from "../coordinates"
import type { CanvasEngine } from "../engine/engine"
import type { ToImageOptions } from "../options"
import { getBoundTextBounds } from "../text-bindings"
import type { CanvasElement } from "../types"
import type { DomState } from "./state"
import {
  createElementGroup,
  getArrowHeadHalfWidth,
  svgNamespaceURI,
} from "./svg"

interface ExportBounds {
  left: number
  top: number
  width: number
  height: number
}

// How far an element's paint can extend past its geometry. Strokes are
// centered on the shape outline, and arrowheads are wider than the stroke, so
// the exported region must grow by that much or the content is clipped.
function getElementOverhang(element: CanvasElement): number {
  switch (element.type) {
    case "arrow": {
      return Math.max(
        element.strokeWidth / 2,
        getArrowHeadHalfWidth(element.strokeWidth),
      )
    }
    case "ellipse":
    case "line":
    case "path":
    case "rectangle": {
      return element.strokeWidth / 2
    }
    default: {
      return 0
    }
  }
}

// Visual bounds of the exported elements: axis-aligned, rotation-aware and
// including stroke/arrowhead overhang. Group elements are containers only —
// their children render on their own — so they do not contribute bounds.
// Locked elements do contribute: they are still part of the exported content.
function getExportBounds(elements: CanvasElement[]): ExportBounds | null {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity

  for (const element of elements) {
    if (element.type === "group") {
      continue
    }

    const overhang = getElementOverhang(element)
    const bounds = getElementBounds(
      element.x,
      element.y,
      element.width,
      element.height,
      element.rotation,
    )

    left = Math.min(left, bounds.left - overhang)
    right = Math.max(right, bounds.right + overhang)
    top = Math.min(top, bounds.top - overhang)
    bottom = Math.max(bottom, bounds.bottom + overhang)
  }

  if (left === Infinity) {
    return null
  }

  return { height: bottom - top, left, top, width: right - left }
}

export async function toImage(
  state: DomState,
  engine: CanvasEngine,
  options: ToImageOptions = {},
): Promise<Blob> {
  const {
    background = false,
    darkMode = false,
    exclude,
    format = "png",
    padding = 0,
    quality = 0.92,
    scale = 1,
  } = options

  // Same order as the DOM adapter: ascending z-index, stable for equal
  // z-indexes. Hidden and excluded elements are left out of both the drawing
  // and the bounds, so `exclude` also crops the exported region.
  const elements = [...engine.getElements().values()]
    .filter((element) => element.visible && !exclude?.(element))
    .toSorted((a, b) => a.zIndex - b.zIndex)

  const bounds = getExportBounds(elements)
  const areaX = bounds ? bounds.left - padding : 0
  const areaY = bounds ? bounds.top - padding : 0
  const areaW = Math.max(1, (bounds?.width ?? 0) + padding * 2)
  const areaH = Math.max(1, (bounds?.height ?? 0) + padding * 2)

  const computedStyle = getComputedStyle(state.container!)

  // A string is an explicit paint color. `true` (or JPEG, which has no alpha)
  // uses the container's `--adraw-background`, falling back to the default.
  let backgroundFill: string | null = null
  if (typeof background === "string" && background.trim()) {
    backgroundFill = background
  } else if (background || format === "jpeg") {
    backgroundFill =
      computedStyle.getPropertyValue("--adraw-background").trim() ||
      BACKGROUND_COLOR
  }

  const style = document.createElementNS(svgNamespaceURI, "style")
  const colorScheme = darkMode ? "dark" : "light"
  const strokeColor = computedStyle.getPropertyValue("--adraw-stroke")
  style.textContent = `:root{color-scheme:${colorScheme};--adraw-stroke:${strokeColor};--adraw-fill:transparent}`

  const svg = document.createElementNS(svgNamespaceURI, "svg")
  svg.setAttribute("xmlns", svgNamespaceURI)
  svg.setAttribute("viewBox", `${areaX} ${areaY} ${areaW} ${areaH}`)
  svg.setAttribute("width", `${areaW}`)
  svg.setAttribute("height", `${areaH}`)
  svg.appendChild(style)

  if (backgroundFill) {
    const bg = document.createElementNS(svgNamespaceURI, "rect")
    bg.setAttribute("x", `${areaX}`)
    bg.setAttribute("y", `${areaY}`)
    bg.setAttribute("width", `${areaW}`)
    bg.setAttribute("height", `${areaH}`)
    bg.setAttribute("fill", backgroundFill)
    svg.appendChild(bg)
  }

  for (const element of elements) {
    const arrowLabelBox =
      element.type === "arrow"
        ? getBoundTextBounds(engine.getElements(), element.id)
        : null
    svg.appendChild(
      createElementGroup(element, engine.getTextMeasurer(), arrowLabelBox),
    )
  }

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svg)
  const svgBlob = new Blob([svgStr], {
    type: "image/svg+xml;charset=utf-8",
  })

  if (format === "svg") {
    return svgBlob
  }

  const url = URL.createObjectURL(svgBlob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () =>
        reject(new Error("toImage: failed to rasterize SVG"))
      image.src = url
    })

    const canvas = document.createElement("canvas")
    canvas.width = Math.round(areaW * scale)
    canvas.height = Math.round(areaH * scale)
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("toImage: canvas.toBlob returned null"))
          }
        },
        `image/${format}`,
        quality,
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
