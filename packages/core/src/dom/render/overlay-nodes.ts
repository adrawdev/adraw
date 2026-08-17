import { BACKGROUND_COLOR, SELECTION_COLOR } from "../../constants"
import type { CanvasEngine } from "../../engine/engine"
import { getSelectionBox } from "../../engine/internal"
import type { DomState } from "../state"
import {
  boundingBoxStrokeWidth,
  resizeEdgeClass,
  resizeHandleClass,
  resizeHandleSize,
  rotationHandleClass,
  selectionBoxClass,
  svgNamespaceURI,
} from "../svg"

// Draw the active tool's in-progress marquee (rubber-band) selection as a
// dashed box in the overlay layer. Reuses a single persistent node, hidden via
// `display` when there's no marquee, instead of recreating it per render.
export function renderSelectionBox(
  state: DomState,
  engine: CanvasEngine,
): void {
  if (!state.transformOverlay) {
    return
  }

  const box = getSelectionBox(engine)
  if (!box || (box.width === 0 && box.height === 0)) {
    state.selectionBoxNode?.remove()
    return
  }

  if (!state.selectionBoxNode) {
    const rect = document.createElementNS(svgNamespaceURI, "rect")
    rect.classList.add(selectionBoxClass)
    rect.setAttribute("fill", SELECTION_COLOR)
    rect.setAttribute("fill-opacity", "0.1")
    rect.setAttribute("stroke", SELECTION_COLOR)
    rect.setAttribute("stroke-opacity", "0.5")
    rect.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
    rect.setAttribute("vector-effect", "non-scaling-stroke")
    state.selectionBoxNode = rect
  }

  // Append after the overlay group (rendered first) so the marquee stays on
  // top; no-op re-append while it's already attached.
  if (state.selectionBoxNode.parentNode !== state.transformOverlay) {
    state.transformOverlay.appendChild(state.selectionBoxNode)
  }

  const handleSize = resizeHandleSize / engine.getViewport().zoom
  const rect = state.selectionBoxNode
  rect.setAttribute("x", `${box.x}`)
  rect.setAttribute("y", `${box.y}`)
  rect.setAttribute("rx", `${handleSize / 4}`)
  rect.setAttribute("width", `${box.width}`)
  rect.setAttribute("height", `${box.height}`)
}

// Build the overlay's bounding box, edge bands, rotation handle and resize
// handles once. Subsequent renders update these nodes in place (see
// `renderTransformOverlay`) rather than recreating them.
export function ensureOverlayNodes(state: DomState) {
  if (state.overlayNodes) {
    return state.overlayNodes
  }

  const group = document.createElementNS(svgNamespaceURI, "g")

  // Main bounding box
  const boundingBox = document.createElementNS(svgNamespaceURI, "rect")
  boundingBox.setAttribute("fill", "none")
  boundingBox.setAttribute("stroke", SELECTION_COLOR)
  boundingBox.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
  boundingBox.setAttribute("vector-effect", "non-scaling-stroke")
  group.appendChild(boundingBox)

  // Invisible edge bands — dragging an edge resizes along that axis. They carry
  // the `*-center` anchors so the select tool's existing resize logic handles
  // them exactly like the old edge-center handles did.
  const edgeAnchors = [
    "top-center",
    "right-center",
    "bottom-center",
    "left-center",
  ]
  const edges = edgeAnchors.map((anchor) => {
    const line = document.createElementNS(svgNamespaceURI, "line")
    line.classList.add(resizeEdgeClass)
    line.setAttribute("stroke", "transparent")
    line.setAttribute("pointer-events", "stroke")
    line.setAttribute("data-anchor", anchor)
    group.appendChild(line)
    return line
  })

  // Rotation handle
  const rotationHandle = document.createElementNS(svgNamespaceURI, "circle")
  rotationHandle.classList.add(rotationHandleClass)
  rotationHandle.setAttribute("fill", BACKGROUND_COLOR)
  rotationHandle.setAttribute("stroke", SELECTION_COLOR)
  rotationHandle.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
  rotationHandle.setAttribute("vector-effect", "non-scaling-stroke")
  rotationHandle.setAttribute("data-anchor", "rotation")
  group.appendChild(rotationHandle)

  // Resize handles (corners)
  const handleAnchors = ["top-left", "top-right", "bottom-right", "bottom-left"]
  const resizeHandles = handleAnchors.map((anchor) => {
    const square = document.createElementNS(svgNamespaceURI, "rect")
    square.classList.add(resizeHandleClass)
    square.setAttribute("fill", BACKGROUND_COLOR)
    square.setAttribute("stroke", SELECTION_COLOR)
    square.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
    square.setAttribute("vector-effect", "non-scaling-stroke")
    square.setAttribute("data-anchor", anchor)
    group.appendChild(square)
    return square
  })

  // Line endpoint handles
  const lineAnchors = ["line-start", "line-end"]
  const lineHandles = lineAnchors.map((anchor) => {
    const square = document.createElementNS(svgNamespaceURI, "rect")
    square.classList.add(resizeHandleClass)
    square.setAttribute("fill", BACKGROUND_COLOR)
    square.setAttribute("stroke", SELECTION_COLOR)
    square.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
    square.setAttribute("vector-effect", "non-scaling-stroke")
    square.setAttribute("data-anchor", anchor)
    group.appendChild(square)
    return square
  })

  // Not appended here — `renderTransformOverlay` attaches the group only when
  // there's a selection and detaches it otherwise.
  state.overlayNodes = {
    boundingBox,
    edges,
    group,
    lineHandles,
    resizeHandles,
    rotationHandle,
  }
  return state.overlayNodes
}
