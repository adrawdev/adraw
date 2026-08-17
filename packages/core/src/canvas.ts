import {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  mountDom,
  type MountedDom,
} from "./dom/adapter"
import { renderAll } from "./dom/render"
import { toImage } from "./dom/to-image"
import { CanvasEngine } from "./engine/engine"
import {
  applyWheelTransform,
  dispatchPointerDownAt,
  dispatchPointerMoveAt,
  dispatchPointerUpAt,
} from "./engine/internal"
import type {
  AdrawCanvasOptions,
  CanvasEventMap,
  MediaInput,
  ToImageOptions,
} from "./options"
import type { SnappingConfig } from "./snapping"
import type {
  CanvasElement,
  ElementId,
  MediaElement,
  ToolType,
  ViewportState,
} from "./types"

export type {
  AdrawCanvasOptions,
  CanvasEventMap,
  CanvasOptions,
  MediaInput,
  ToImageOptions,
} from "./options"
export { createElementGroup, pointsToPath } from "./dom/svg"

// Facade: composes the headless `CanvasEngine` (state, tools, history, events)
// with the DOM adapter in `dom/` (SVG mount, event wiring, text editor, render).
export class AdrawCanvas {
  private engine: CanvasEngine
  private mounted: MountedDom | null = null

  constructor(options: AdrawCanvasOptions = {}) {
    this.engine = new CanvasEngine(options)

    if (options.container) {
      this.mount(options.container)
    }
  }

  setCanvasSize(width: number, height: number): void {
    this.engine.setCanvasSize(width, height)
  }

  setActiveTool(toolType: ToolType): void {
    this.engine.setActiveTool(toolType)
  }

  getActiveTool(): ToolType {
    return this.engine.getActiveTool()
  }

  getViewport(): ViewportState {
    return this.engine.getViewport()
  }

  setViewport(viewport: ViewportState): void {
    this.engine.setViewport(viewport)
  }

  getElements(): Map<ElementId, CanvasElement> {
    return this.engine.getElements()
  }

  insertMedia(descriptors: MediaInput | MediaInput[]): MediaElement[] {
    return this.engine.insertMedia(descriptors)
  }

  getSelectedIds(): Set<ElementId> {
    return this.engine.getSelectedIds()
  }

  getSnappingConfig(): SnappingConfig {
    return this.engine.getSnappingConfig()
  }

  setSnappingConfig(config: Partial<SnappingConfig>): void {
    this.engine.setSnappingConfig(config)
  }

  setStrokeColor(color: string): void {
    this.engine.setStrokeColor(color)
  }

  getHideOverlayWhileTransforming(): boolean {
    return this.engine.getHideOverlayWhileTransforming()
  }

  setHideOverlayWhileTransforming(hide: boolean): void {
    this.engine.setHideOverlayWhileTransforming(hide)
  }

  canUndo(): boolean {
    return this.engine.canUndo()
  }

  canRedo(): boolean {
    return this.engine.canRedo()
  }

  undo(): boolean {
    return this.engine.undo()
  }

  redo(): boolean {
    return this.engine.redo()
  }

  handlePointerDown(
    screenX: number,
    screenY: number,
    event: PointerEvent,
  ): void {
    if (this.mounted) {
      handlePointerDown(
        this.mounted.state,
        this.engine,
        screenX,
        screenY,
        event,
      )
      return
    }
    dispatchPointerDownAt(this.engine, screenX, screenY, event)
  }

  handlePointerMove(
    screenX: number,
    screenY: number,
    event: PointerEvent,
  ): void {
    if (this.mounted) {
      handlePointerMove(
        this.mounted.state,
        this.engine,
        screenX,
        screenY,
        event,
      )
      return
    }
    dispatchPointerMoveAt(this.engine, screenX, screenY, event)
  }

  handlePointerUp(screenX: number, screenY: number, event: PointerEvent): void {
    if (this.mounted) {
      handlePointerUp(this.mounted.state, this.engine, screenX, screenY, event)
      return
    }
    dispatchPointerUpAt(this.engine, screenX, screenY, event)
  }

  handleWheel(event: WheelEvent, screenX?: number, screenY?: number): void {
    applyWheelTransform(this.engine, event, screenX, screenY)
  }

  handleKeyDown(event: KeyboardEvent): void {
    this.engine.handleKeyDown(event)
  }

  selectAll(): void {
    this.engine.selectAll()
  }

  clearSelection(): void {
    this.engine.clearSelection()
  }

  deleteSelected(): void {
    this.engine.deleteSelected()
  }

  zoomIn(): void {
    this.engine.zoomIn()
  }

  zoomOut(): void {
    this.engine.zoomOut()
  }

  resetZoom(): void {
    this.engine.resetZoom()
  }

  zoomToFit(): void {
    this.engine.zoomToFit()
  }

  getTemporaryElement(): CanvasElement | null {
    return this.engine.getTemporaryElement()
  }

  on<K extends keyof CanvasEventMap>(
    event: K,
    listener: (payload: CanvasEventMap[K]) => void,
  ): void {
    this.engine.on(event, listener)
  }

  off<K extends keyof CanvasEventMap>(
    event: K,
    listener: (payload: CanvasEventMap[K]) => void,
  ): void {
    this.engine.off(event, listener)
  }

  // ── DOM adapter ──

  // Attach the canvas to a DOM container, creating the SVG layers and wiring up
  // pointer/wheel/touch/keyboard events. Safe to call once; no-op if mounted.
  mount(container: HTMLElement): void {
    if (this.mounted) {
      return
    }
    this.mounted = mountDom(this.engine, container)
    renderAll(this.mounted.state, this.engine)
  }

  render(): void {
    if (this.mounted) {
      renderAll(this.mounted.state, this.engine)
    }
  }

  destroy(): void {
    this.mounted?.destroy()
    this.mounted = null
  }

  async toImage(options: ToImageOptions = {}): Promise<Blob> {
    if (!this.mounted) {
      throw new Error("toImage requires a mounted canvas")
    }
    return toImage(this.mounted.state, this.engine, options)
  }
}
