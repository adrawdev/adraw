import { STROKE_COLOR } from "../constants"
import { getElementsBounds } from "../elements"
import {
  canRedo,
  canUndo,
  createHistoryState,
  pushHistory,
  redo,
  undo,
} from "../history"
import type { CanvasEventMap, CanvasOptions, MediaInput } from "../options"
import { createSnappingConfig, type SnappingConfig } from "../snapping"
import {
  createDrawTool,
  createEllipseTool,
  createEraserTool,
  createHandTool,
  createLineTool,
  createRectangleTool,
  createSelectTool,
  createTextTool,
} from "../tools"
import type { Tool, ToolContext } from "../tools/base"
import type {
  CanvasElement,
  ElementId,
  MediaElement,
  ToolType,
  ViewportState,
} from "../types"
import { createViewport, resetViewport, zoomViewport } from "../viewport"
import { createMediaElements } from "./media"
import {
  deleteSelectedElements,
  selectAllIds,
  computeZoomToFitViewport,
} from "./selection"
import { handleShortcutKey } from "./shortcuts"

type EventListener<K extends keyof CanvasEventMap> = (
  event: CanvasEventMap[K],
) => void

export interface EngineInternal {
  getActiveTool: () => ToolType
  getActiveToolInstance: () => Tool
  getCanvasSize: () => { height: number; width: number }
  getElements: () => Map<ElementId, CanvasElement>
  getSelectedIds: () => Set<ElementId>
  getToolContext: () => ToolContext
  getViewport: () => ViewportState
  setViewport: (viewport: ViewportState) => void
  setSelectedIds: (ids: Set<ElementId>) => void
  pushHistory: () => void
  emit: <K extends keyof CanvasEventMap>(
    event: K,
    data: CanvasEventMap[K],
  ) => void
}

// Headless canvas engine: pure state (elements, selection, viewport, tools,
// history) plus the event system. No DOM — a DOM adapter (see `dom/`) drives it
// through the public API and the `/** @internal */` hooks below.
export class CanvasEngine {
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

  // Fired when a render is needed (e.g. the overlay toggle re-renders
  // immediately). The DOM adapter sets this; null when headless.
  /** @internal */
  renderRequested: (() => void) | null = null
  // Fired just before the active tool changes so the adapter can commit any
  // in-progress DOM state (e.g. an open inline text editor).
  /** @internal */
  onToolWillChange: (() => void) | null = null

  constructor(options: CanvasOptions = {}) {
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
    this.tools.set("text", createTextTool())

    this.activeTool = this.tools.get("select")!
    this.activeTool.onActivate(this.createToolContext())

    // Seed the baseline checkpoint so the first edit can be undone back to the
    // empty canvas. The top of the undo stack always mirrors the current
    // committed state.
    this.history = pushHistory(this.history, this.elements, this.selectedIds)
  }

  private createToolContext(): ToolContext {
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

    // A toolbar click or keyboard shortcut switching tools mid-edit must not
    // leave the editor orphaned; commit whatever was typed.
    this.onToolWillChange?.()

    this.activeTool.onDeactivate(this.createToolContext())
    this.activeTool = newTool
    this.activeTool.onActivate(this.createToolContext())
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
    const elements = createMediaElements(
      inputs,
      this.viewport,
      this.canvasSize,
      maxZ + 1,
    )

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
    this.renderRequested?.()
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

  handleKeyDown(event: KeyboardEvent): void {
    handleShortcutKey(event, this)
  }

  selectAll(): void {
    this.selectedIds = selectAllIds(this.elements)
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  clearSelection(): void {
    this.selectedIds = new Set()
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  deleteSelected(): void {
    const result = deleteSelectedElements(
      this.elements,
      this.selectedIds,
      this.history,
    )
    if (!result) {
      return
    }
    this.elements = result.elements
    this.history = result.history
    this.selectedIds = result.selectedIds
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

    const viewport = computeZoomToFitViewport(bounds, this.canvasSize)
    if (!viewport) {
      return
    }

    this.viewport = viewport
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

  /** @internal */
  emit<K extends keyof CanvasEventMap>(
    event: K,
    data: CanvasEventMap[K],
  ): void {
    this.listeners.get(event)?.forEach((listener) => {
      listener(data)
    })
  }

  // ── Adapter-facing internals (`engine/internal.ts` hooks) ──

  /** @internal */
  getActiveToolInstance(): Tool {
    return this.activeTool
  }

  /** @internal */
  getCanvasSize(): { width: number; height: number } {
    return this.canvasSize
  }

  /** @internal */
  getToolContext(): ToolContext {
    return this.createToolContext()
  }

  /** @internal */
  setSelectedIds(ids: Set<ElementId>): void {
    this.selectedIds = ids
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  /** @internal */
  pushHistory(): void {
    this.history = pushHistory(this.history, this.elements, this.selectedIds)
  }
}
