import { BACKGROUND_COLOR } from "../constants"
import type { CanvasEngine } from "../engine/engine"
import type { CanvasEventMap } from "../options"
import { setupEventListeners, updateCursor } from "./events"
import { cancelTextGesture } from "./pointer"
import { renderAll } from "./render"
import { reconcileElements, renderSelectElements } from "./render/elements"
import { renderGuides } from "./render/guides"
import { renderTransformOverlay } from "./render/overlay"
import { createDomState, type DomState } from "./state"
import {
  elementsGroupClass,
  guidesGroupClass,
  svgNamespaceURI,
  transformOverlayClass,
} from "./svg"
import { commitTextEditing } from "./text-editor"

export interface MountedDom {
  destroy: () => void
  state: DomState
}

// Mount the DOM adapter into `container`: build the SVG layers, wire pointer /
// wheel / touch / keyboard events, and subscribe to engine events so renders
// follow state changes.
export function mountDom(
  engine: CanvasEngine,
  container: HTMLElement,
): MountedDom {
  const state = createDomState()
  state.container = container
  initDom(state, engine)
  const removeEventListeners = setupEventListeners(state, engine)

  engine.renderRequested = () => renderAll(state, engine)
  engine.onToolWillChange = () => {
    commitTextEditing(state, engine, { switchTool: false })
    cancelTextGesture(state, engine)
    renderAll(state, engine)
  }

  const handleChange = (): void => {
    if (engine.getActiveTool() === "select") {
      renderSelectElements(state, engine)
    }
    reconcileElements(state, engine)
    renderGuides(state, engine)
  }

  const handleViewportChange = (): void => {
    renderAll(state, engine)
  }

  const handleToolChange = ({ tool }: CanvasEventMap["toolChange"]): void => {
    renderGuides(state, engine)
    renderTransformOverlay(state, engine)
    updateCursor(state, tool)
  }

  const handleSelectionChange = (): void => {
    renderSelectElements(state, engine)
    renderTransformOverlay(state, engine)
  }

  engine.on("change", handleChange)
  engine.on("viewportChange", handleViewportChange)
  engine.on("toolChange", handleToolChange)
  engine.on("selectionChange", handleSelectionChange)

  return {
    destroy: () => {
      removeEventListeners()
      engine.off("change", handleChange)
      engine.off("viewportChange", handleViewportChange)
      engine.off("toolChange", handleToolChange)
      engine.off("selectionChange", handleSelectionChange)
      engine.renderRequested = null
      engine.onToolWillChange = null
      state.resizeObserver?.disconnect()
      state.textEditor?.remove()
      state.textEditPoint = null
      state.textEditElementId = null
      state.textEditOriginalElement = null
      state.textGesture = null
      state.svgElement?.remove()
    },
    state,
  }
}

function initDom(state: DomState, engine: CanvasEngine): void {
  if (!state.container) {
    return
  }

  state.svgElement = document.createElementNS(svgNamespaceURI, "svg")
  state.svgElement.setAttribute("width", "100%")
  state.svgElement.setAttribute("height", "100%")
  state.svgElement.style.display = "block"
  state.svgElement.style.background = BACKGROUND_COLOR
  state.svgElement.style.touchAction = "none"

  state.elementsGroup = document.createElementNS(svgNamespaceURI, "g")
  state.elementsGroup.classList.add(elementsGroupClass)

  state.guidesGroup = document.createElementNS(svgNamespaceURI, "g")
  state.guidesGroup.classList.add(guidesGroupClass)

  state.transformOverlay = document.createElementNS(svgNamespaceURI, "g")
  state.transformOverlay.classList.add(transformOverlayClass)
  // Overlay children belong to the fresh `transformOverlay`; drop stale refs
  // so they're rebuilt into it on the next render (e.g. after a re-mount).
  // The element node caches likewise start empty against the fresh group.
  state.overlayNodes = null
  state.selectionBoxNode = null
  state.multiSelectionGroup = null
  state.multiSelectionNodes.clear()
  state.nodeById.clear()
  state.pathPointSigs.clear()
  state.renderedGeometry.clear()

  state.svgElement.appendChild(state.elementsGroup)
  state.svgElement.appendChild(state.guidesGroup)
  state.svgElement.appendChild(state.transformOverlay)
  state.container.appendChild(state.svgElement)

  state.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      engine.setCanvasSize(width, height)
      renderAll(state, engine)
    }
  })
  state.resizeObserver.observe(state.container)
}

export {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
} from "./pointer"
