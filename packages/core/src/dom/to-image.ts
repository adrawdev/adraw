import { getElementsBounds } from "../elements"
import type { CanvasEngine } from "../engine/engine"
import type { ToImageOptions } from "../options"
import type { DomState } from "./state"
import { createElementGroup, svgNamespaceURI } from "./svg"

export async function toImage(
  state: DomState,
  engine: CanvasEngine,
  options: ToImageOptions = {},
): Promise<Blob> {
  const {
    format = "png",
    background = false,
    padding = 0,
    scale = 1,
    quality = 0.92,
    darkMode = false,
  } = options

  const elements = engine.getElements()
  const visibleElements = [...elements.values()]
    .filter((el) => el.visible)
    .toSorted((a, b) => a.zIndex - b.zIndex)

  const bounds = getElementsBounds(elements)
  if (!bounds || visibleElements.length === 0) {
    if (format === "svg") {
      return new Blob([], { type: "image/svg+xml;charset=utf-8" })
    }
    const c = document.createElement("canvas")
    c.width = 1
    c.height = 1
    return new Promise<Blob>((resolve, reject) => {
      c.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("toImage: canvas.toBlob returned null"))
          }
        },
        `image/${format === "jpeg" ? "png" : format}`,
        quality,
      )
    })
  }

  const areaX = bounds.left - padding
  const areaY = bounds.top - padding
  const areaW = Math.max(1, bounds.width + padding * 2)
  const areaH = Math.max(1, bounds.height + padding * 2)

  const computedStyle = getComputedStyle(state.container!)
  const bgColor =
    background || format === "jpeg"
      ? computedStyle.getPropertyValue("--adraw-background")
      : undefined

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

  if (bgColor) {
    const bg = document.createElementNS(svgNamespaceURI, "rect")
    bg.setAttribute("x", `${areaX}`)
    bg.setAttribute("y", `${areaY}`)
    bg.setAttribute("width", `${areaW}`)
    bg.setAttribute("height", `${areaH}`)
    bg.setAttribute("fill", bgColor)
    svg.appendChild(bg)
  }

  for (const element of visibleElements) {
    const group = createElementGroup(element)
    svg.appendChild(group)
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
