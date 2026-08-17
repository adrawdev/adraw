import { STROKE_COLOR, TEXT_FONT_SIZE } from "../constants"
import type { CanvasEngine } from "../engine/engine"
import type { CanvasElement, TextElement } from "../types"
import { renderTransformOverlay } from "./render/overlay"
import { renderSelectionBox } from "./render/overlay-nodes"
import type { DomState } from "./state"
import {
  appendTextLines,
  createElementGroup,
  getTransformElementAttribute,
  pointsToPath,
  temporaryClass,
} from "./svg"

export function renderAll(state: DomState, engine: CanvasEngine): void {
  if (!state.container) {
    return
  }

  const viewport = engine.getViewport()
  const transform = `translate(${state.container.clientWidth / 2}, ${state.container.clientHeight / 2}) scale(${viewport.zoom}) translate(${-viewport.x}, ${-viewport.y})`

  for (const group of [state.elementsGroup, state.transformOverlay]) {
    group?.setAttribute("transform", transform)
  }

  renderTemporary(state, engine)
  renderTransformOverlay(state, engine)
  renderSelectionBox(state, engine)
  positionTextEditor(state, engine)
}

export function renderTemporary(state: DomState, engine: CanvasEngine): void {
  if (!state.elementsGroup) {
    return
  }

  const tempElement = engine.getTemporaryElement()

  // No in-progress element: drop the temporary node if one is lingering. It
  // may already have been adopted by `reconcileElements` as a committed
  // element's node (tools like text commit the same object/id their temporary
  // element used) — leave those alone.
  if (!tempElement) {
    if (
      state.temporaryNode &&
      !engine.getElements().has(state.temporaryNode.id)
    ) {
      state.temporaryNode.remove()
    }
    state.temporaryNode = null
    state.temporaryType = null
    return
  }

  // The temporary element lives inside `elementsGroup` (on top, as the last
  // child). Reuse its node across pointer moves — while the type is unchanged,
  // update it in place rather than recreating it. Only build a fresh node when
  // there is none yet or the element type changed.
  if (!state.temporaryNode || state.temporaryType !== tempElement.type) {
    state.temporaryNode?.remove()
    const group = createElementGroup(tempElement)
    group.classList.add(temporaryClass)
    state.temporaryNode = group
    state.temporaryType = tempElement.type
    state.elementsGroup.appendChild(group)
    return
  }

  updateElementGeometry(state.temporaryNode, tempElement)
}

// Update an existing element's DOM node (transform + type-specific geometry)
// in place, without recreating it.
export function updateElementGeometry(
  group: SVGGElement,
  element: CanvasElement,
): void {
  group.setAttribute("transform", getTransformElementAttribute(element))

  switch (element.type) {
    case "line": {
      const lineElement = group.getElementsByTagName("line")[0]
      lineElement.setAttribute("x1", `${element.startX}`)
      lineElement.setAttribute("y1", `${element.startY}`)
      lineElement.setAttribute("x2", `${element.endX}`)
      lineElement.setAttribute("y2", `${element.endY}`)
      lineElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      break
    }
    case "path": {
      const pathElement = group.getElementsByTagName("path")[0]
      pathElement.setAttribute(
        "d",
        pointsToPath(element.points, element.smoothing),
      )
      pathElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      break
    }
    case "rectangle": {
      const rectElement = group.getElementsByTagName("rect")[0]
      rectElement.setAttribute("width", `${element.width}`)
      rectElement.setAttribute("height", `${element.height}`)
      rectElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      break
    }
    case "ellipse": {
      const ellipseElement = group.getElementsByTagName("ellipse")[0]
      ellipseElement.setAttribute("cx", `${element.width / 2}`)
      ellipseElement.setAttribute("cy", `${element.height / 2}`)
      ellipseElement.setAttribute("rx", `${element.width / 2}`)
      ellipseElement.setAttribute("ry", `${element.height / 2}`)
      ellipseElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      break
    }
    case "media": {
      const imageElement = group.getElementsByTagName("image")[0]
      imageElement.setAttribute("width", `${element.width}`)
      imageElement.setAttribute("height", `${element.height}`)
      break
    }
    case "text": {
      const textElement = group.getElementsByTagName("text")[0]
      textElement.setAttribute("font-size", `${element.fontSize}`)
      textElement.setAttribute("fill", element.strokeColor || STROKE_COLOR)
      textElement.textContent = ""
      appendTextLines(textElement, element)
      break
    }
  }
}

// Keep the editor anchored to its canvas-space point (and sized to its
// content) across zoom/pan/typing.
export function positionTextEditor(
  state: DomState,
  engine: CanvasEngine,
): void {
  if (!state.textEditor || !state.textEditPoint) {
    return
  }

  const viewport = engine.getViewport()
  const canvasSize = engine.getCanvasSize()
  const screenX =
    (state.textEditPoint.x - viewport.x) * viewport.zoom + canvasSize.width / 2
  const screenY =
    (state.textEditPoint.y - viewport.y) * viewport.zoom + canvasSize.height / 2

  const fontSize =
    (state.textEditElementId
      ? (
          engine.getElements().get(state.textEditElementId) as
            | TextElement
            | undefined
        )?.fontSize
      : undefined) ?? TEXT_FONT_SIZE

  const style = state.textEditor.style
  style.fontSize = `${fontSize * viewport.zoom}px`
  style.lineHeight = `${fontSize * 1.2 * viewport.zoom}px`
  style.left = `${screenX}px`
  style.top = `${screenY}px`
  style.width = "auto"
  style.width = `${Math.max(60, state.textEditor.scrollWidth + 8)}px`
  const lines = state.textEditor.value.split("\n").length
  style.height = `${Math.max(24, lines * fontSize * 1.2 * viewport.zoom + 4)}px`
}
