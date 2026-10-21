import {
  AdrawCanvas,
  type CanvasElement,
  type ConfigurableToolType,
  type ElementId,
  resolveAllToolOptions,
  type ResolvedToolOptions,
  type ToolOptionsMap,
  type ToolOptionsState,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  type Provider,
  signal,
} from "@angular/core"

import { CANVAS_OPTIONS, type CanvasAngularOptions } from "./canvas.tokens"

// One AdrawCanvas per service instance. The core is created headless in the
// constructor and mounted later by <adraw-canvas>, so every method here is
// safe to call before mount — it just operates on headless state. Core state
// is mirrored into Angular signals by subscribing to the four core events.
/**
 * Injectable service wrapping a headless `AdrawCanvas`. Core state is mirrored
 * into Angular signals by subscribing to the four core events. Safe to use
 * before mount.
 */
@Injectable()
export class CanvasService {
  private readonly core: AdrawCanvas

  private readonly _elements = signal<Map<ElementId, CanvasElement>>(new Map())
  private readonly _viewport = signal<ViewportState>({ x: 0, y: 0, zoom: 1 })
  private readonly _activeTool = signal<ToolType>("select")
  private readonly _selectedIds = signal<Set<ElementId>>(new Set())
  private readonly _hideWhileTransforming = signal(true)
  private readonly _isReady = signal(false)
  private readonly _toolOptions = signal<ToolOptionsState>(
    resolveAllToolOptions(),
  )
  private readonly onReady?: (engine: AdrawCanvas) => void
  private readyNotified = false

  // Read-only views of the mirrored core state. Consumers read them by calling
  // the signal (including in templates); state only ever changes via the core.
  readonly elements = this._elements.asReadonly()
  readonly viewport = this._viewport.asReadonly()
  readonly activeTool = this._activeTool.asReadonly()
  readonly selectedIds = this._selectedIds.asReadonly()
  readonly hideWhileTransforming = this._hideWhileTransforming.asReadonly()
  readonly isReady = this._isReady.asReadonly()
  readonly toolOptions = this._toolOptions.asReadonly()

  // Bumped on every "change" event (draw, erase, undo, redo, delete) so the
  // canUndo/canRedo computeds recompute even though the core's history stack
  // isn't itself reactive.
  private readonly historyVersion = signal(0)

  readonly canUndo = computed(() => {
    this.historyVersion()
    return this.core.canUndo()
  })

  readonly canRedo = computed(() => {
    this.historyVersion()
    return this.core.canRedo()
  })

  constructor() {
    const options = inject(CANVAS_OPTIONS, { optional: true })
    const { onReady, ...coreOptions } = options ?? {}
    this.onReady = onReady
    this.core = new AdrawCanvas(coreOptions)
    // Core defaults this to false; the Angular adapter documents `true`.
    this.core.setHideOverlayWhileTransforming(
      options?.hideOverlayWhileTransforming ?? true,
    )

    this._elements.set(new Map(this.core.getElements()))
    this._viewport.set(this.core.getViewport())
    this._activeTool.set(this.core.getActiveTool())
    this._selectedIds.set(new Set(this.core.getSelectedIds()))
    this._hideWhileTransforming.set(this.core.getHideOverlayWhileTransforming())
    this._toolOptions.set(resolveAllToolOptions(options?.tools))

    this.core.on("change", ({ elements }) => {
      this._elements.set(new Map(elements))
      this.historyVersion.update((v) => v + 1)
    })
    this.core.on("viewportChange", ({ viewport }) => {
      this._viewport.set(viewport)
    })
    this.core.on("toolChange", ({ tool }) => {
      this._activeTool.set(tool)
    })
    this.core.on("selectionChange", ({ selectedIds }) => {
      this._selectedIds.set(new Set(selectedIds))
    })
    this.core.on("toolOptionsChange", ({ tool, options: nextOptions }) => {
      this._toolOptions.update(
        (previous) =>
          ({ ...previous, [tool]: nextOptions }) as ToolOptionsState,
      )
    })

    inject(DestroyRef).onDestroy(() => {
      this.core.destroy()
      this._isReady.set(false)
    })
  }

  /** The underlying vanilla AdrawCanvas instance. */
  get instance(): AdrawCanvas {
    return this.core
  }

  /**
   * Mount the canvas into a container element (called by `<adraw-canvas>`).
   * @param container Container element.
   */
  mount(container: HTMLElement): void {
    this.core.mount(container)
    this.core.render()
    this._isReady.set(true)

    if (!this.readyNotified) {
      this.readyNotified = true
      this.onReady?.(this.core)
    }
  }

  /**
   * Tear down the DOM adapter while keeping the engine (and its document)
   * available for a later remount.
   */
  unmount(): void {
    this.core.destroy()
    this._isReady.set(false)
  }

  /**
   * Set the active tool.
   * @param tool Tool identifier.
   */
  setTool(tool: ToolType): void {
    this.core.setActiveTool(tool)
  }

  /**
   * Get a tool's fully resolved style options.
   * @param tool Configurable tool identifier.
   * @returns Resolved style options.
   */
  getToolOptions<T extends ConfigurableToolType>(
    tool: T,
  ): ResolvedToolOptions<T> {
    return this.core.getToolOptions(tool)
  }

  /**
   * Merge partial style options for a tool.
   * @param tool Configurable tool identifier.
   * @param options Partial options.
   */
  setToolOptions<T extends ConfigurableToolType>(
    tool: T,
    options: ToolOptionsMap[T],
  ): void {
    this.core.setToolOptions(tool, options)
  }

  /**
   * Set transform-overlay visibility.
   * @param hide Hide flag.
   */
  setHideWhileTransforming(hide: boolean): void {
    this.core.setHideOverlayWhileTransforming(hide)
    this._hideWhileTransforming.set(hide)
  }

  /**
   * Set the viewport.
   * @param viewport New viewport.
   */
  setViewport(viewport: ViewportState): void {
    this.core.setViewport(viewport)
  }

  /** Zoom in by one step. */
  zoomIn(): void {
    this.core.zoomIn()
  }

  /** Zoom out by one step. */
  zoomOut(): void {
    this.core.zoomOut()
  }

  /** Reset zoom to 1. */
  resetZoom(): void {
    this.core.resetZoom()
  }

  /** Zoom to fit content, optionally with custom padding or bounds. */
  zoomToFit(options?: ZoomToFitOptions): void {
    this.core.zoomToFit(options)
  }

  /** Undo the last change. @returns Whether applied. */
  undo(): boolean {
    return this.core.undo()
  }

  /** Redo the last undone change. @returns Whether applied. */
  redo(): boolean {
    return this.core.redo()
  }

  /** Select all elements. */
  selectAll(): void {
    this.core.selectAll()
  }

  /** Clear the selection. */
  clearSelection(): void {
    this.core.clearSelection()
  }

  /** Delete the selected elements. */
  deleteSelected(): void {
    this.core.deleteSelected()
  }
}

// Registers a component-scoped CanvasService (plus its options, when given).
// Add it to the `providers` of the component that hosts both <adraw-canvas>
// and any toolbar/controls, so they all inject the same instance. Each
// component that calls provideCanvas() gets its own independent canvas, so
// multiple canvases can coexist on one page.
export function provideCanvas(options?: CanvasAngularOptions): Provider[] {
  const providers: Provider[] = [CanvasService]
  if (options) {
    providers.push({ provide: CANVAS_OPTIONS, useValue: options })
  }
  return providers
}
