import type { ElementId, Point, TextElement, ViewportState } from "../types"

export interface OverlayNodes {
  group: SVGGElement
  boundingBox: SVGRectElement
  edges: SVGLineElement[]
  rotationHandle: SVGCircleElement
  resizeHandles: SVGRectElement[]
  lineHandles?: SVGRectElement[]
}

// All mutable DOM-adapter state, owned by `mountDom` and shared between the
// adapter, text-editor and render modules.
export interface DomState {
  container: HTMLElement | null
  svgElement: SVGSVGElement | null
  elementsGroup: SVGGElement | null
  // The in-progress element (from the active tool) is rendered directly into
  // `elementsGroup`; this tracks its node so it can be updated/removed in place.
  temporaryNode: SVGGElement | null
  // Element type the current `temporaryNode` was built for, so `renderTemporary`
  // can update it in place while the type is unchanged instead of recreating it.
  temporaryType: string | null
  guidesGroup: SVGGElement | null
  transformOverlay: SVGGElement | null
  // Persistent transform-overlay nodes. Built once and updated in place on every
  // render (rather than wiping `transformOverlay` and recreating ~10 SVG nodes
  // per pointer move). The cached `group` is detached from the DOM when there's
  // no selection and re-attached otherwise, so it stays absent (not just hidden)
  // when nothing is selected.
  overlayNodes: OverlayNodes | null
  // Persistent marquee (rubber-band) node, likewise reused across renders.
  selectionBoxNode: SVGRectElement | null
  resizeObserver: ResizeObserver | null
  // Inline text editing state. The editor is an absolutely-positioned
  // `<textarea>` overlay owned by the DOM adapter: it appears when the text
  // tool places a new element (editing the tool's temporary element) or when a
  // text element is double-clicked (editing the committed element in place).
  textEditor: HTMLTextAreaElement | null
  textEditPoint: Point | null
  // Non-null while editing an existing element; null while creating a new one
  // through the text tool's temporary element.
  textEditElementId: ElementId | null
  // Snapshot of the element being edited, restored on cancel.
  textEditOriginalElement: TextElement | null
  // Touch gesture state
  pinchStartDistance: number | null
  pinchStartCenter: Point | null
  pinchViewportState: ViewportState | null
}

export function createDomState(): DomState {
  return {
    container: null,
    elementsGroup: null,
    guidesGroup: null,
    overlayNodes: null,
    pinchStartCenter: null,
    pinchStartDistance: null,
    pinchViewportState: null,
    resizeObserver: null,
    selectionBoxNode: null,
    svgElement: null,
    temporaryNode: null,
    temporaryType: null,
    textEditElementId: null,
    textEditOriginalElement: null,
    textEditPoint: null,
    textEditor: null,
    transformOverlay: null,
  }
}
