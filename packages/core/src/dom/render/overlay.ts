import { getElementsBounds } from "../../elements"
import type { CanvasEngine } from "../../engine/engine"
import { isRotating, isTransforming } from "../../engine/internal"
import type { LineElement, Point } from "../../types"
import type { DomState } from "../state"
import {
  resizeHandleSize,
  rotationHandleRadio,
  rotationHandleSpacing,
} from "../svg"
import { ensureOverlayNodes } from "./overlay-nodes"

export function renderTransformOverlay(
  state: DomState,
  engine: CanvasEngine,
): void {
  if (!state.transformOverlay) {
    return
  }

  const nodes = ensureOverlayNodes(state)
  const selectedIds = engine.getSelectedIds()
  const elements = engine.getElements()

  // Hide the bounding box + handles while actively resizing/rotating so the
  // overlay doesn't lag the element mid-gesture; it reappears on pointer up.
  // Opt out via the `hideOverlayWhileTransforming` option.
  const transforming = isTransforming(engine)
  const suppressed =
    (engine.getHideOverlayWhileTransforming() && transforming) ||
    (isRotating(engine) && selectedIds.size > 1)

  const bounds =
    selectedIds.size === 0 || suppressed
      ? null
      : getElementsBounds(elements, selectedIds)
  if (!bounds) {
    nodes.group.remove()
    return
  }
  // Attach the cached group when needed; no-op while it's already attached.
  if (nodes.group.parentNode !== state.transformOverlay) {
    state.transformOverlay.appendChild(nodes.group)
  }

  const { x, y, width, height } = bounds

  // Rotate the overlay to match a single selected element's rotation.
  let transform = ""
  if (selectedIds.size === 1) {
    const [onlyId] = selectedIds
    const element = elements.get(onlyId)
    if (element && element.rotation) {
      transform = `rotate(${element.rotation}, ${x + width / 2}, ${y + height / 2})`
    }
  }
  if (transform) {
    nodes.group.setAttribute("transform", transform)
  } else {
    nodes.group.removeAttribute("transform")
  }

  const handleSize = resizeHandleSize / engine.getViewport().zoom

  // Check if the single selected element is a line
  const isLine =
    selectedIds.size === 1 && elements.get([...selectedIds][0])?.type === "line"

  if (isLine) {
    const lineEl = elements.get([...selectedIds][0]) as LineElement

    // Hide standard overlay elements
    nodes.boundingBox.setAttribute("display", "none")
    for (const edge of nodes.edges) {
      edge.setAttribute("display", "none")
    }
    nodes.rotationHandle.setAttribute("display", "none")
    for (const handle of nodes.resizeHandles) {
      handle.setAttribute("display", "none")
    }

    // Show line endpoint handles
    const anchors: Point[] = [
      { x: lineEl.startX, y: lineEl.startY },
      { x: lineEl.endX, y: lineEl.endY },
    ]
    for (let i = 0; i < anchors.length; i++) {
      const h = anchors[i]
      const node = nodes.lineHandles![i]
      node.setAttribute("display", "inline")
      node.setAttribute("x", `${h.x - handleSize / 2}`)
      node.setAttribute("y", `${h.y - handleSize / 2}`)
      node.setAttribute("rx", `${handleSize}`)
      node.setAttribute("width", `${handleSize}`)
      node.setAttribute("height", `${handleSize}`)
    }
  } else {
    // Show standard overlay, hide line handles
    nodes.boundingBox.setAttribute("display", "inline")
    for (const edge of nodes.edges) {
      edge.setAttribute("display", "inline")
    }
    nodes.rotationHandle.setAttribute("display", "inline")
    for (const handle of nodes.resizeHandles) {
      handle.setAttribute("display", "inline")
    }
    for (const handle of nodes.lineHandles!) {
      handle.setAttribute("display", "none")
    }

    // Main bounding box
    const rect = nodes.boundingBox
    rect.setAttribute("x", `${x}`)
    rect.setAttribute("y", `${y}`)
    rect.setAttribute("rx", `${handleSize / 4}`)
    rect.setAttribute("width", `${width}`)
    rect.setAttribute("height", `${height}`)

    // Edge bands — same order as `edgeAnchors` in `ensureOverlayNodes`.
    const edgeGeom = [
      { x1: x, x2: x + width, y1: y, y2: y },
      { x1: x + width, x2: x + width, y1: y, y2: y + height },
      { x1: x, x2: x + width, y1: y + height, y2: y + height },
      { x1: x, x2: x, y1: y, y2: y + height },
    ]
    for (let i = 0; i < edgeGeom.length; i++) {
      const line = nodes.edges[i]
      const g = edgeGeom[i]
      line.setAttribute("x1", `${g.x1}`)
      line.setAttribute("y1", `${g.y1}`)
      line.setAttribute("x2", `${g.x2}`)
      line.setAttribute("y2", `${g.y2}`)
      line.setAttribute("stroke-width", `${handleSize}`)
    }

    // Rotation handle
    const rotationHandleY =
      y - rotationHandleSpacing / engine.getViewport().zoom
    const rotationHandleR = rotationHandleRadio / engine.getViewport().zoom
    nodes.rotationHandle.setAttribute("cx", `${x + width / 2}`)
    nodes.rotationHandle.setAttribute("cy", `${rotationHandleY}`)
    nodes.rotationHandle.setAttribute("r", `${rotationHandleR}`)

    // Resize handle — same order as `handleAnchors` in `ensureOverlayNodes`.
    const handleGeom = [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ]
    for (let i = 0; i < handleGeom.length; i++) {
      const square = nodes.resizeHandles[i]
      const h = handleGeom[i]
      square.setAttribute("x", `${h.x - handleSize / 2}`)
      square.setAttribute("y", `${h.y - handleSize / 2}`)
      square.setAttribute("rx", `${handleSize / 4}`)
      square.setAttribute("width", `${handleSize}`)
      square.setAttribute("height", `${handleSize}`)
    }
  }
}
