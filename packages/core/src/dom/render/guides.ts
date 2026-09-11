import { SELECTION_COLOR } from "../../constants"
import type { CanvasEngine } from "../../engine/engine"
import type { DomState } from "../state"
import { snapGuideClass, snapGuideStrokeWidth, svgNamespaceURI } from "../svg"

// Draw alignment guides for the in-progress snap gesture as full-viewport
// dashed lines. Nodes are pooled in `state.guideNodes` and reused across
// renders instead of being recreated per pointer move.
export function renderGuides(state: DomState, engine: CanvasEngine): void {
  const group = state.guidesGroup
  if (!group) {
    return
  }

  const guides = engine.getSnapGuides()

  while (state.guideNodes.length > guides.length) {
    state.guideNodes.pop()?.remove()
  }
  while (state.guideNodes.length < guides.length) {
    const line = document.createElementNS(svgNamespaceURI, "line")
    line.classList.add(snapGuideClass)
    line.setAttribute("stroke", SELECTION_COLOR)
    line.setAttribute("stroke-width", `${snapGuideStrokeWidth}`)
    line.setAttribute("stroke-dasharray", "4 4")
    line.setAttribute("vector-effect", "non-scaling-stroke")
    line.setAttribute("pointer-events", "none")
    state.guideNodes.push(line)
    group.appendChild(line)
  }

  const viewport = engine.getViewport()
  const canvasSize = engine.getCanvasSize()
  const halfWidth = canvasSize.width / 2 / viewport.zoom
  const halfHeight = canvasSize.height / 2 / viewport.zoom

  guides.forEach((guide, index) => {
    const line = state.guideNodes[index]
    if (guide.type === "vertical") {
      line.setAttribute("x1", `${guide.position}`)
      line.setAttribute("x2", `${guide.position}`)
      line.setAttribute("y1", `${viewport.y - halfHeight}`)
      line.setAttribute("y2", `${viewport.y + halfHeight}`)
    } else {
      line.setAttribute("x1", `${viewport.x - halfWidth}`)
      line.setAttribute("x2", `${viewport.x + halfWidth}`)
      line.setAttribute("y1", `${guide.position}`)
      line.setAttribute("y2", `${guide.position}`)
    }
  })
}
