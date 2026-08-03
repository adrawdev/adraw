import {
  BACKGROUND_COLOR,
  FILL_COLOR,
  SELECTION_COLOR,
  STROKE_COLOR,
  STROKE_WIDTH,
} from "./constants"
import { screenToCanvas } from "./coordinates"
import {
  createMedia,
  DEFAULT_PATH_SMOOTHING,
  getElementsBounds,
} from "./elements"
import {
  canRedo,
  canUndo,
  createHistoryState,
  pushHistory,
  redo,
  undo,
} from "./history"
import { createSnappingConfig, type SnappingConfig } from "./snapping"
import {
  createDrawTool,
  createEllipseTool,
  createEraserTool,
  createHandTool,
  createLineTool,
  createRectangleTool,
  createSelectTool,
} from "./tools"
import type { Tool, ToolContext } from "./tools/base"
import type {
  CanvasElement,
  ElementId,
  LineElement,
  MediaElement,
  Point,
  ToolType,
  ViewportState,
} from "./types"
import {
  createViewport,
  panViewport,
  resetViewport,
  zoomViewport,
} from "./viewport"

export interface CanvasOptions {
  snapping?: Partial<SnappingConfig>
  initialViewport?: ViewportState
  // Hide the selection bounding box + resize/rotation handles while a
  // resize/rotation gesture is in progress, so the overlay doesn't lag the
  // element mid-gesture; it reappears on pointer up. Defaults to `true`.
  hideOverlayWhileTransforming?: boolean
}

export interface AdrawCanvasOptions extends CanvasOptions {
  // When provided, the canvas mounts into this container immediately. Omit it to
  // create a headless instance (state only) and call `mount(container)` later.
  container?: HTMLElement
}

export interface ToImageOptions {
  background?: boolean
  darkMode?: boolean
  format?: "png" | "jpeg" | "webp" | "svg"
  padding?: number
  scale?: number
  quality?: number
}

export interface MediaInput {
  src: string
  mimeType: string
  naturalWidth: number
  naturalHeight: number
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface CanvasEventMap {
  change: { elements: Map<ElementId, CanvasElement> }
  viewportChange: { viewport: ViewportState }
  toolChange: { tool: ToolType }
  selectionChange: { selectedIds: Set<ElementId> }
}

type EventListener<K extends keyof CanvasEventMap> = (
  event: CanvasEventMap[K],
) => void

const svgNamespaceURI = "http://www.w3.org/2000/svg"
const elementsGroupClass = "adraw-elements-group"
const elementClass = "adraw-element"
const temporaryClass = "adraw-temporary"
const guidesGroupClass = "adraw-guides-group"
const selectedClass = "adraw-selected"
const transformOverlayClass = "adraw-transform-overlay"
const rotationHandleClass = "adraw-rotation-handle"
const resizeHandleClass = "adraw-resize-handle"
const resizeEdgeClass = "adraw-resize-edge"
const selectionBoxClass = "adraw-selection-box"

const boundingBoxStrokeWidth = 2
const resizeHandleSize = 12
const rotationHandleRadio = 6
const rotationHandleSpacing = 30

// Cursor for each resize/rotation handle, keyed by its `data-anchor` value.
const handleCursorMap: Record<string, string> = {
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

function getTransformElementAttribute(element: CanvasElement) {
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
  }

  return group
}

export class AdrawCanvas {
  // ── Canvas state (pure logic, available headless) ──
  private elements = new Map<ElementId, CanvasElement>()
  private selectedIds = new Set<ElementId>()
  private viewport: ViewportState
  private activeTool: Tool
  private snappingConfig: SnappingConfig
  private strokeColor: string = STROKE_COLOR
  private hideOverlayWhileTransforming: boolean
  private history = createHistoryState()
  private listeners = new Map<keyof CanvasEventMap, Set<EventListener<any>>>()
  private canvasSize: { width: number; height: number } = {
    height: 0,
    width: 0,
  }
  private tools = new Map<ToolType, Tool>()

  // ── DOM adapter (populated by mount) ──
  private container: HTMLElement | null = null
  private svgElement: SVGSVGElement | null = null
  private elementsGroup: SVGGElement | null = null
  // The in-progress element (from the active tool) is rendered directly into
  // `elementsGroup`; this tracks its node so it can be updated/removed in place.
  private temporaryNode: SVGGElement | null = null
  // Element type the current `temporaryNode` was built for, so `renderTemporary`
  // can update it in place while the type is unchanged instead of recreating it.
  private temporaryType: CanvasElement["type"] | null = null
  private guidesGroup: SVGGElement | null = null
  private transformOverlay: SVGGElement | null = null
  // Persistent transform-overlay nodes. Built once and updated in place on every
  // render (rather than wiping `transformOverlay` and recreating ~10 SVG nodes
  // per pointer move). The cached `group` is detached from the DOM when there's
  // no selection and re-attached otherwise, so it stays absent (not just hidden)
  // when nothing is selected.
  private overlayNodes: {
    group: SVGGElement
    boundingBox: SVGRectElement
    edges: SVGLineElement[]
    rotationHandle: SVGCircleElement
    resizeHandles: SVGRectElement[]
    lineHandles?: SVGRectElement[]
  } | null = null
  // Persistent marquee (rubber-band) node, likewise reused across renders.
  private selectionBoxNode: SVGRectElement | null = null
  private resizeObserver: ResizeObserver | null = null

  // Touch gesture state
  private pinchStartDistance: number | null = null
  private pinchStartCenter: Point | null = null
  private pinchViewportState: ViewportState | null = null

  constructor(options: AdrawCanvasOptions = {}) {
    this.viewport = createViewport(options.initialViewport)
    this.snappingConfig = createSnappingConfig(options.snapping)
    this.hideOverlayWhileTransforming =
      options.hideOverlayWhileTransforming ?? false

    this.tools.set("select", createSelectTool())
    this.tools.set("hand", createHandTool())
    this.tools.set("rectangle", createRectangleTool())
    this.tools.set("ellipse", createEllipseTool())
    this.tools.set("line", createLineTool())
    this.tools.set("draw", createDrawTool())
    this.tools.set("eraser", createEraserTool())

    this.activeTool = this.tools.get("select")!
    this.activeTool.onActivate(this.getToolContext())

    // Seed the baseline checkpoint so the first edit can be undone back to the
    // empty canvas. The top of the undo stack always mirrors the current
    // committed state.
    this.history = pushHistory(this.history, this.elements, this.selectedIds)

    if (options.container) {
      this.mount(options.container)
    }
  }

  private getToolContext(): ToolContext {
    return {
      getCanvasSize: () => this.canvasSize,
      getElements: () => this.elements,
      getSelectedIds: () => this.selectedIds,
      getStrokeColor: () => this.strokeColor,
      getViewport: () => this.viewport,
      pushHistory: () => {
        this.history = pushHistory(
          this.history,
          this.elements,
          this.selectedIds,
        )
      },
      setActiveTool: (tool) => this.setActiveTool(tool),
      setElements: (elements) => {
        this.elements = elements
        this.emit("change", { elements: this.elements })
      },
      setSelectedIds: (ids) => {
        this.selectedIds = ids
        this.emit("selectionChange", { selectedIds: this.selectedIds })
      },
      setViewport: (viewport) => {
        this.viewport = viewport
        this.emit("viewportChange", { viewport: this.viewport })
      },
    }
  }

  setCanvasSize(width: number, height: number): void {
    this.canvasSize = { height, width }
  }

  setActiveTool(toolType: ToolType): void {
    const newTool = this.tools.get(toolType)
    if (!newTool || newTool === this.activeTool) {
      return
    }

    this.activeTool.onDeactivate(this.getToolContext())
    this.activeTool = newTool
    this.activeTool.onActivate(this.getToolContext())
    this.emit("toolChange", { tool: toolType })
  }

  getActiveTool(): ToolType {
    return this.activeTool.type
  }

  getViewport(): ViewportState {
    return this.viewport
  }

  setViewport(viewport: ViewportState): void {
    this.viewport = viewport
    this.emit("viewportChange", { viewport: this.viewport })
  }

  getElements(): Map<ElementId, CanvasElement> {
    return this.elements
  }

  insertMedia(descriptors: MediaInput | MediaInput[]): MediaElement[] {
    const inputs = Array.isArray(descriptors) ? descriptors : [descriptors]
    if (inputs.length === 0) {
      return []
    }

    const maxZ = Math.max(
      0,
      ...[...this.elements.values()].map((el) => el.zIndex),
    )
    const elements: MediaElement[] = []

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]

      let width: number
      let height: number

      if (input.width != null && input.height != null) {
        width = input.width
        height = input.height
      } else if (input.width != null) {
        width = input.width
        height = Math.round(
          (input.width / input.naturalWidth) * input.naturalHeight,
        )
      } else if (input.height != null) {
        height = input.height
        width = Math.round(
          (input.height / input.naturalHeight) * input.naturalWidth,
        )
      } else if (this.canvasSize.width > 0 && this.canvasSize.height > 0) {
        const visibleWidth = this.canvasSize.width / this.viewport.zoom
        const visibleHeight = this.canvasSize.height / this.viewport.zoom
        const padding = 100 / this.viewport.zoom
        const availableWidth = Math.max(1, visibleWidth - padding)
        const availableHeight = Math.max(1, visibleHeight - padding)
        const scale = Math.min(
          availableWidth / input.naturalWidth,
          availableHeight / input.naturalHeight,
          1,
        )
        width = Math.round(input.naturalWidth * scale)
        height = Math.round(input.naturalHeight * scale)
      } else {
        width = input.naturalWidth
        height = input.naturalHeight
      }

      const x = input.x ?? this.viewport.x - width / 2
      const y = input.y ?? this.viewport.y - height / 2

      elements.push(
        createMedia({
          height,
          locked: false,
          mimeType: input.mimeType,
          naturalHeight: input.naturalHeight,
          naturalWidth: input.naturalWidth,
          rotation: 0,
          src: input.src,
          visible: true,
          width,
          x,
          y,
          zIndex: maxZ + 1 + i,
        }),
      )
    }

    this.history = pushHistory(this.history, this.elements, this.selectedIds)

    for (const element of elements) {
      this.elements.set(element.id, element)
    }

    this.emit("change", { elements: this.elements })
    this.selectedIds = new Set(elements.map((elem) => elem.id))
    this.emit("selectionChange", { selectedIds: this.selectedIds })
    if (this.activeTool.type !== "select") {
      this.setActiveTool("select")
    }
    return elements
  }

  getSelectedIds(): Set<ElementId> {
    return this.selectedIds
  }

  getSnappingConfig(): SnappingConfig {
    return this.snappingConfig
  }

  setSnappingConfig(config: Partial<SnappingConfig>): void {
    this.snappingConfig = { ...this.snappingConfig, ...config }
  }

  setStrokeColor(color: string): void {
    this.strokeColor = color

    if (this.selectedIds.size > 0) {
      for (const id of this.selectedIds) {
        const element = this.elements.get(id)
        if (element && "strokeColor" in element) {
          this.elements.set(id, { ...element, strokeColor: color })
        }
      }
    }

    this.emit("change", { elements: this.elements })
  }

  getHideOverlayWhileTransforming(): boolean {
    return this.hideOverlayWhileTransforming
  }

  setHideOverlayWhileTransforming(hide: boolean): void {
    this.hideOverlayWhileTransforming = hide
    // Re-render so the overlay reflects the change immediately (e.g. toggled
    // mid-gesture).
    this.render()
  }

  canUndo(): boolean {
    return canUndo(this.history)
  }

  canRedo(): boolean {
    return canRedo(this.history)
  }

  undo(): boolean {
    const result = undo(this.history, this.elements, this.selectedIds)
    if (result) {
      this.elements = result.elements
      this.selectedIds = result.selectedIds
      this.history = result.state
      this.emit("change", { elements: this.elements })
      this.emit("selectionChange", { selectedIds: this.selectedIds })
      return true
    }
    return false
  }

  redo(): boolean {
    const result = redo(this.history, this.elements, this.selectedIds)
    if (result) {
      this.elements = result.elements
      this.selectedIds = result.selectedIds
      this.history = result.state
      this.emit("change", { elements: this.elements })
      this.emit("selectionChange", { selectedIds: this.selectedIds })
      return true
    }
    return false
  }

  handlePointerDown(
    screenX: number,
    screenY: number,
    event: PointerEvent,
  ): void {
    const point = screenToCanvas(
      { x: screenX, y: screenY },
      this.viewport,
      this.canvasSize,
    )
    this.activeTool.onPointerDown(this.getToolContext(), point, event)
  }

  handlePointerMove(
    screenX: number,
    screenY: number,
    event: PointerEvent,
  ): void {
    const point = screenToCanvas(
      { x: screenX, y: screenY },
      this.viewport,
      this.canvasSize,
    )
    this.activeTool.onPointerMove(this.getToolContext(), point, event)
  }

  handlePointerUp(screenX: number, screenY: number, event: PointerEvent): void {
    const point = screenToCanvas(
      { x: screenX, y: screenY },
      this.viewport,
      this.canvasSize,
    )
    this.activeTool.onPointerUp(this.getToolContext(), point, event)
  }

  handleWheel(event: WheelEvent, screenX?: number, screenY?: number): void {
    event.preventDefault()

    if (event.ctrlKey || event.metaKey) {
      let x = screenX ?? event.clientX
      let y = screenY ?? event.clientY

      if (screenX === undefined || screenY === undefined) {
        const currentTarget = event.currentTarget as HTMLElement | null
        if (currentTarget) {
          const rect = currentTarget.getBoundingClientRect()
          x = event.clientX - rect.left
          y = event.clientY - rect.top
        }
      }

      const centerPoint = {
        x:
          (this.canvasSize.width / 2 - x) / this.viewport.zoom +
          this.viewport.x,
        y:
          (this.canvasSize.height / 2 - y) / this.viewport.zoom +
          this.viewport.y,
      }
      this.viewport = zoomViewport(this.viewport, event.deltaY, centerPoint)
    } else {
      this.viewport = panViewport(this.viewport, {
        x: event.deltaX / this.viewport.zoom,
        y: event.deltaY / this.viewport.zoom,
      })
    }

    this.emit("viewportChange", { viewport: this.viewport })
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    const key = event.key.toLowerCase()

    if (event.ctrlKey || event.metaKey) {
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        this.undo()
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        this.redo()
      } else if (key === "a") {
        event.preventDefault()
        this.selectAll()
      }
    } else {
      switch (key) {
        case "v": {
          this.setActiveTool("select")
          break
        }
        case "h": {
          this.setActiveTool("hand")
          break
        }
        case "d": {
          this.setActiveTool("draw")
          break
        }
        case "e": {
          this.setActiveTool("eraser")
          break
        }
        case "r": {
          this.setActiveTool("rectangle")
          break
        }
        case "l": {
          this.setActiveTool("line")
          break
        }
        case "delete":
        case "backspace": {
          this.deleteSelected()
          break
        }
        case "escape": {
          this.clearSelection()
          break
        }
      }
    }
  }

  selectAll(): void {
    this.selectedIds = new Set(this.elements.keys())
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  clearSelection(): void {
    this.selectedIds = new Set()
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  deleteSelected(): void {
    if (this.selectedIds.size === 0) {
      return
    }

    for (const id of this.selectedIds) {
      this.elements.delete(id)
    }

    this.history = pushHistory(this.history, this.elements, this.selectedIds)
    this.selectedIds = new Set()
    this.emit("change", { elements: this.elements })
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  zoomIn(): void {
    const center = { x: 0, y: 0 }
    this.viewport = zoomViewport(this.viewport, -100, center)
    this.emit("viewportChange", { viewport: this.viewport })
  }

  zoomOut(): void {
    const center = { x: 0, y: 0 }
    this.viewport = zoomViewport(this.viewport, 100, center)
    this.emit("viewportChange", { viewport: this.viewport })
  }

  resetZoom(): void {
    this.viewport = resetViewport()
    this.emit("viewportChange", { viewport: this.viewport })
  }

  zoomToFit(): void {
    const bounds = getElementsBounds(this.elements)
    if (!bounds) {
      return
    }

    const contentWidth = bounds.right - bounds.left
    const contentHeight = bounds.bottom - bounds.top

    if (contentWidth === 0 || contentHeight === 0) {
      return
    }

    const availableWidth = this.canvasSize.width - 100
    const availableHeight = this.canvasSize.height - 100

    const scaleX = availableWidth / contentWidth
    const scaleY = availableHeight / contentHeight
    const newZoom = Math.min(scaleX, scaleY, 10)

    this.viewport = {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
      zoom: Math.max(0.1, newZoom),
    }

    this.emit("viewportChange", { viewport: this.viewport })
  }

  getTemporaryElement(): CanvasElement | null {
    return this.activeTool.getTemporaryElement()
  }

  on<K extends keyof CanvasEventMap>(
    event: K,
    listener: EventListener<K>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  off<K extends keyof CanvasEventMap>(
    event: K,
    listener: EventListener<K>,
  ): void {
    this.listeners.get(event)?.delete(listener)
  }

  private emit<K extends keyof CanvasEventMap>(
    event: K,
    data: CanvasEventMap[K],
  ): void {
    this.listeners.get(event)?.forEach((listener) => {
      listener(data)
    })
  }

  // ── DOM adapter ──

  // Attach the canvas to a DOM container, creating the SVG layers and wiring up
  // pointer/wheel/touch/keyboard events. Safe to call once; no-op if mounted.
  mount(container: HTMLElement): void {
    if (this.svgElement) {
      return
    }
    this.container = container
    this.init()
    this.setupEventListeners()
    this.render()
  }

  private init(): void {
    if (!this.container) {
      return
    }

    this.svgElement = document.createElementNS(svgNamespaceURI, "svg")
    this.svgElement.setAttribute("width", "100%")
    this.svgElement.setAttribute("height", "100%")
    this.svgElement.style.display = "block"
    this.svgElement.style.background = BACKGROUND_COLOR
    this.svgElement.style.touchAction = "none"

    this.elementsGroup = document.createElementNS(svgNamespaceURI, "g")
    this.elementsGroup.classList.add(elementsGroupClass)

    this.guidesGroup = document.createElementNS(svgNamespaceURI, "g")
    this.guidesGroup.classList.add(guidesGroupClass)

    this.transformOverlay = document.createElementNS(svgNamespaceURI, "g")
    this.transformOverlay.classList.add(transformOverlayClass)
    // Overlay children belong to the fresh `transformOverlay`; drop stale refs
    // so they're rebuilt into it on the next render (e.g. after a re-mount).
    this.overlayNodes = null
    this.selectionBoxNode = null

    this.svgElement.appendChild(this.elementsGroup)
    this.svgElement.appendChild(this.guidesGroup)
    this.svgElement.appendChild(this.transformOverlay)
    this.container.appendChild(this.svgElement)

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        this.setCanvasSize(width, height)
        this.render()
      }
    })
    this.resizeObserver.observe(this.container)
  }

  private getRelativePoint(event: MouseEvent | PointerEvent | WheelEvent): {
    x: number
    y: number
  } {
    if (!this.svgElement) {
      return { x: event.clientX, y: event.clientY }
    }
    const rect = this.svgElement.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  private setupEventListeners(): void {
    if (!this.svgElement) {
      return
    }

    this.svgElement.addEventListener("pointerdown", (event) => {
      const { x, y } = this.getRelativePoint(event)
      this.handlePointerDown(x, y, event)
      // Capture the pointer so pointermove/pointerup keep firing while the
      // cursor leaves the container — or the browser window — mid-drag.
      try {
        this.svgElement?.setPointerCapture(event.pointerId)
      } catch {
        // Capture unavailable (e.g. synthetic events in tests) — ignore.
      }
      this.render()
    })

    this.svgElement.addEventListener("pointermove", (event) => {
      const { x, y } = this.getRelativePoint(event)
      this.handlePointerMove(x, y, event)
      this.render()
    })

    this.svgElement.addEventListener("pointerup", (event) => {
      const { x, y } = this.getRelativePoint(event)
      this.handlePointerUp(x, y, event)
      this.render()
    })

    // A cancelled pointer (e.g. the OS takes over the drag) still needs the
    // tool's gesture finalized the same way a pointerup would.
    this.svgElement.addEventListener("pointercancel", (event) => {
      const { x, y } = this.getRelativePoint(event)
      this.handlePointerUp(x, y, event)
      this.render()
    })

    // Set cursor based on hovered handle. Skipped mid-drag: with pointer
    // capture, moves outside the container retarget to the svg (no anchor), and
    // resetting the cursor would fight the drag cursor.
    this.svgElement.addEventListener("pointermove", (event) => {
      if (event.buttons > 0 || !this.svgElement) {
        return
      }
      const target = event.target as HTMLElement
      const anchor = target.getAttribute("data-anchor")
      if (anchor && handleCursorMap[anchor]) {
        this.svgElement.style.cursor = handleCursorMap[anchor]
      } else if (!this.svgElement.style.cursor.startsWith("grab")) {
        this.svgElement.style.cursor = "default"
      }
    })

    this.svgElement.addEventListener(
      "wheel",
      (event) => {
        const { x, y } = this.getRelativePoint(event)
        this.handleWheel(event, x, y)
        this.render()
      },
      { passive: false },
    )

    this.svgElement.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length === 2) {
          event.preventDefault()
          this.pinchStartDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          )
          this.pinchStartCenter = {
            x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
            y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
          }
          this.pinchViewportState = { ...this.getViewport() }
        } else if (event.touches.length === 1) {
          const touch = event.touches[0] as unknown as PointerEvent
          const { x, y } = this.getRelativePoint(touch)
          this.handlePointerDown(x, y, touch)
          this.render()
        }
      },
      { passive: false },
    )

    this.svgElement.addEventListener(
      "touchmove",
      (event) => {
        if (
          event.touches.length === 2 &&
          this.pinchStartDistance !== null &&
          this.pinchStartCenter &&
          this.pinchViewportState
        ) {
          event.preventDefault()

          const currentDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          )
          const currentCenter = {
            x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
            y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
          }

          const scale = currentDistance / this.pinchStartDistance

          // Apply scaling relative to the start state and start center point
          const rect = this.svgElement?.getBoundingClientRect()
          if (!rect) {
            return
          }

          const canvasCenter = {
            x:
              (this.pinchStartCenter.x - rect.left - rect.width / 2) /
                this.pinchViewportState.zoom +
              this.pinchViewportState.x,
            y:
              (this.pinchStartCenter.y - rect.top - rect.height / 2) /
                this.pinchViewportState.zoom +
              this.pinchViewportState.y,
          }

          let newViewport = { ...this.pinchViewportState }

          // Set zoom directly from the pinch scale ratio (clamped), rather than
          // routing through zoomViewport which expects a wheel deltaY.
          newViewport.zoom = Math.max(
            0.1,
            Math.min(this.pinchViewportState.zoom * scale, 10),
          )

          // Adjust position so the center stays exactly where it was
          newViewport.x =
            canvasCenter.x -
            (canvasCenter.x - this.pinchViewportState.x) *
              (this.pinchViewportState.zoom / newViewport.zoom)
          newViewport.y =
            canvasCenter.y -
            (canvasCenter.y - this.pinchViewportState.y) *
              (this.pinchViewportState.zoom / newViewport.zoom)

          newViewport = panViewport(newViewport, {
            x: (this.pinchStartCenter.x - currentCenter.x) / newViewport.zoom,
            y: (this.pinchStartCenter.y - currentCenter.y) / newViewport.zoom,
          })

          this.setViewport(newViewport)
          this.render()
        } else if (event.touches.length === 1 && !this.pinchStartDistance) {
          const touch = event.touches[0] as unknown as PointerEvent
          const { x, y } = this.getRelativePoint(touch)
          this.handlePointerMove(x, y, touch)
          this.render()
        }
      },
      { passive: false },
    )

    this.svgElement.addEventListener("touchend", (event) => {
      this.handleTouchEnd(event)
    })

    this.svgElement.addEventListener("touchcancel", (event) => {
      this.handleTouchEnd(event)
    })

    document.addEventListener("keydown", (event) => {
      this.handleKeyDown(event)
      this.render()
    })

    this.on("change", () => {
      if (this.getActiveTool() === "select") {
        this.renderSelectElements()
      }
      this.reconcileElements()
    })

    this.on("viewportChange", () => {
      this.render()
    })

    this.on("toolChange", ({ tool }) => {
      this.renderTransformOverlay()
      this.updateCursor(tool)
    })

    this.on("selectionChange", () => {
      this.renderSelectElements()
    })
  }

  private handleTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      this.pinchStartDistance = null
      this.pinchStartCenter = null
      this.pinchViewportState = null
    }

    if (event.touches.length === 0) {
      const touch = event.changedTouches[0] as unknown as PointerEvent
      const { x, y } = this.getRelativePoint(touch)
      this.handlePointerUp(x, y, touch)
      this.render()
    }
  }

  private updateCursor(tool: ToolType): void {
    const cursors: Record<ToolType, string> = {
      draw: "crosshair",
      ellipse: "crosshair",
      eraser: "crosshair",
      hand: "grab",
      line: "crosshair",
      rectangle: "crosshair",
      select: "default",
    }
    if (this.svgElement) {
      this.svgElement.style.cursor = cursors[tool] || "default"
    }
  }

  render(): void {
    if (!this.container) {
      return
    }

    const viewport = this.getViewport()
    const transform = `translate(${this.container.clientWidth / 2}, ${this.container.clientHeight / 2}) scale(${viewport.zoom}) translate(${-viewport.x}, ${-viewport.y})`

    for (const group of [this.elementsGroup, this.transformOverlay]) {
      group?.setAttribute("transform", transform)
    }

    this.renderTemporary()
    this.renderTransformOverlay()
    this.renderSelectionBox()
  }

  // Draw the active tool's in-progress marquee (rubber-band) selection as a
  // dashed box in the overlay layer. Reuses a single persistent node, hidden
  // via `display` when there's no marquee, instead of recreating it per render.
  private renderSelectionBox(): void {
    if (!this.transformOverlay) {
      return
    }

    const box = this.activeTool.getSelectionBox?.()
    if (!box || (box.width === 0 && box.height === 0)) {
      this.selectionBoxNode?.remove()
      return
    }

    if (!this.selectionBoxNode) {
      const rect = document.createElementNS(svgNamespaceURI, "rect")
      rect.classList.add(selectionBoxClass)
      rect.setAttribute("fill", SELECTION_COLOR)
      rect.setAttribute("fill-opacity", "0.1")
      rect.setAttribute("stroke", SELECTION_COLOR)
      rect.setAttribute("stroke-opacity", "0.5")
      rect.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
      rect.setAttribute("vector-effect", "non-scaling-stroke")
      this.selectionBoxNode = rect
    }

    // Append after the overlay group (rendered first) so the marquee stays on
    // top; no-op re-append while it's already attached.
    if (this.selectionBoxNode.parentNode !== this.transformOverlay) {
      this.transformOverlay.appendChild(this.selectionBoxNode)
    }

    const handleSize = resizeHandleSize / this.viewport.zoom
    const rect = this.selectionBoxNode
    rect.setAttribute("x", `${box.x}`)
    rect.setAttribute("y", `${box.y}`)
    rect.setAttribute("rx", `${handleSize / 4}`)
    rect.setAttribute("width", `${box.width}`)
    rect.setAttribute("height", `${box.height}`)
  }

  // Build the overlay's bounding box, edge bands, rotation handle and resize
  // handles once. Subsequent renders update these nodes in place (see
  // `renderTransformOverlay`) rather than recreating them.
  private ensureOverlayNodes(): NonNullable<AdrawCanvas["overlayNodes"]> {
    if (this.overlayNodes) {
      return this.overlayNodes
    }

    const group = document.createElementNS(svgNamespaceURI, "g")

    // Main bounding box
    const boundingBox = document.createElementNS(svgNamespaceURI, "rect")
    boundingBox.setAttribute("fill", "none")
    boundingBox.setAttribute("stroke", SELECTION_COLOR)
    boundingBox.setAttribute("stroke-width", `${boundingBoxStrokeWidth}`)
    boundingBox.setAttribute("vector-effect", "non-scaling-stroke")
    group.appendChild(boundingBox)

    // Invisible edge bands — dragging an edge resizes along that axis. They
    // carry the `*-center` anchors so the select tool's existing resize logic
    // handles them exactly like the old edge-center handles did.
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
    const handleAnchors = [
      "top-left",
      "top-right",
      "bottom-right",
      "bottom-left",
    ]
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
    this.overlayNodes = {
      boundingBox,
      edges,
      group,
      lineHandles,
      resizeHandles,
      rotationHandle,
    }
    return this.overlayNodes
  }

  private renderTransformOverlay(): void {
    if (!this.transformOverlay) {
      return
    }

    const nodes = this.ensureOverlayNodes()
    const selectedIds = this.getSelectedIds()
    const elements = this.getElements()

    // Hide the bounding box + handles while actively resizing/rotating so the
    // overlay doesn't lag the element mid-gesture; it reappears on pointer up.
    // Opt out via the `hideOverlayWhileTransforming` option.
    const transforming =
      this.activeTool.isResizing?.() || this.activeTool.isRotating?.()
    const suppressed =
      (this.hideOverlayWhileTransforming && transforming) ||
      (this.activeTool.isRotating?.() && selectedIds.size > 1)

    const bounds =
      selectedIds.size === 0 || suppressed
        ? null
        : getElementsBounds(elements, selectedIds)
    if (!bounds) {
      nodes.group.remove()
      return
    }
    // Attach the cached group when needed; no-op while it's already attached.
    if (nodes.group.parentNode !== this.transformOverlay) {
      this.transformOverlay.appendChild(nodes.group)
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

    const handleSize = resizeHandleSize / this.viewport.zoom

    // Check if the single selected element is a line
    const isLine =
      selectedIds.size === 1 &&
      elements.get([...selectedIds][0])?.type === "line"

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
      const rotationHandleY = y - rotationHandleSpacing / this.viewport.zoom
      const rotationHandleR = rotationHandleRadio / this.viewport.zoom
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

  // Reconcile `elementsGroup` with the current elements without wiping it: add
  // nodes for new elements, update existing ones in place, and drop nodes for
  // elements that no longer exist. This keeps untouched elements' DOM nodes
  // intact when a new element is added (rather than rebuilding the whole group).
  private reconcileElements(): void {
    if (!this.elementsGroup) {
      return
    }

    const elements = this.getElements()
    const selectedIds = this.getSelectedIds()

    // Drop nodes for elements that no longer exist, leaving the temporary node
    // (which has no matching entry in `elements`) untouched. Iterate backwards:
    // `children` is live, so removing during a forward loop would skip nodes.
    const children = this.elementsGroup.children
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      if (child === this.temporaryNode) {
        continue
      }
      if (!elements.has(child.id)) {
        child.remove()
      }
    }

    for (const [, element] of elements) {
      let group = document.getElementById(element.id) as SVGGElement | null

      if (!element.visible) {
        group?.remove()
        continue
      }

      if (group) {
        this.updateElementGeometry(group, element)
      } else {
        group = createElementGroup(element)
        group.classList.add(elementClass)
        this.elementsGroup.appendChild(group)
      }

      group.classList.toggle(selectedClass, selectedIds.has(element.id))
    }
  }

  private renderTemporary(): void {
    if (!this.elementsGroup) {
      return
    }

    const tempElement = this.getTemporaryElement()

    // No in-progress element: drop the temporary node if one is lingering.
    if (!tempElement) {
      this.temporaryNode?.remove()
      this.temporaryNode = null
      this.temporaryType = null
      return
    }

    // The temporary element lives inside `elementsGroup` (on top, as the last
    // child). Reuse its node across pointer moves — while the type is unchanged,
    // update it in place rather than recreating it. Only build a fresh node when
    // there is none yet or the element type changed.
    if (!this.temporaryNode || this.temporaryType !== tempElement.type) {
      this.temporaryNode?.remove()
      const group = createElementGroup(tempElement)
      group.classList.add(temporaryClass)
      this.temporaryNode = group
      this.temporaryType = tempElement.type
      this.elementsGroup.appendChild(group)
      return
    }

    this.updateElementGeometry(this.temporaryNode, tempElement)
  }

  // Update an existing element's DOM node (transform + type-specific geometry)
  // in place, without recreating it.
  private updateElementGeometry(
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
        ellipseElement.setAttribute(
          "stroke",
          element.strokeColor || STROKE_COLOR,
        )
        break
      }
      case "media": {
        const imageElement = group.getElementsByTagName("image")[0]
        imageElement.setAttribute("width", `${element.width}`)
        imageElement.setAttribute("height", `${element.height}`)
        break
      }
    }
  }

  private renderSelectElements(): void {
    if (!this.elementsGroup) {
      return
    }

    const elements = this.getElements()
    const selectedIds = this.getSelectedIds()

    // This is the incremental path (used while the select tool is active), so it
    // updates existing nodes in place rather than rebuilding. It must still drop
    // DOM nodes for elements that no longer exist — e.g. when a selected element
    // is deleted, the "change" handler routes here instead of reconcileElements().
    // Snapshot into an array: `children` is a live collection and removing
    // during iteration would skip nodes.
    for (const child of this.elementsGroup.children) {
      if (!elements.has(child.id)) {
        child.remove()
      }
    }

    for (const [, element] of elements) {
      if (!element.visible) {
        continue
      }

      const group = document.getElementById(element.id) as SVGGElement | null
      if (!group) {
        continue
      }
      const isSelected = selectedIds.has(element.id)
      group.classList.toggle(selectedClass, isSelected)

      if (!isSelected) {
        continue
      }

      // The select tool already transforms geometry in canvas space, so just
      // re-render each node from the current element state.
      this.updateElementGeometry(group, element)
    }
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    this.svgElement?.remove()
  }

  async toImage(options: ToImageOptions = {}): Promise<Blob> {
    const {
      format = "png",
      background = false,
      padding = 0,
      scale = 1,
      quality = 0.92,
      darkMode = false,
    } = options

    const visibleElements = [...this.elements.values()]
      .filter((el) => el.visible)
      .toSorted((a, b) => a.zIndex - b.zIndex)

    const bounds = getElementsBounds(this.elements)
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

    const computedStyle = getComputedStyle(this.container!)
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
}
