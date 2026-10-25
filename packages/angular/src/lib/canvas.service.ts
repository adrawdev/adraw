import {
  AdrawCanvas,
  AdrawStore,
  type AdrawSnapshot,
  type CanvasElement,
  type ElementId,
  type SnappingConfig,
  type StyleOptions,
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
  type Signal,
  type WritableSignal,
} from "@angular/core"

import { CANVAS_OPTIONS, type CanvasAngularOptions } from "./canvas.tokens"

// One AdrawCanvas and AdrawStore per service instance. The core is created
// headless in the constructor and mounted later by <adraw-canvas>, so every
// method here is safe to call before mount — it just operates on headless
// state. The store mirrors state into one snapshot signal; the read-only
// signals below derive from it.
/**
 * Injectable service wrapping a headless `AdrawCanvas` and its `AdrawStore`.
 * Safe to use before mount.
 */
@Injectable()
export class CanvasService {
  private readonly core: AdrawCanvas
  private readonly adrawStore: AdrawStore
  private readonly _snapshot: WritableSignal<AdrawSnapshot>
  private readonly unsubscribe: () => void

  // Read-only views of the store state. Consumers read them by calling the
  // signal (including in templates); state only ever changes via the core.
  readonly snapshot: Signal<AdrawSnapshot>
  readonly elements: Signal<ReadonlyMap<ElementId, CanvasElement>>
  readonly selectedElements: Signal<readonly CanvasElement[]>
  readonly viewport: Signal<ViewportState>
  readonly activeTool: Signal<ToolType>
  readonly selectedIds: Signal<ReadonlySet<ElementId>>
  readonly hideWhileTransforming: Signal<boolean>
  readonly style: Signal<StyleOptions>
  readonly snapping: Signal<SnappingConfig>
  readonly isSnapMode: Signal<boolean>
  readonly isToolLocked: Signal<boolean>
  readonly isReady: Signal<boolean>
  readonly canUndo: Signal<boolean>
  readonly canRedo: Signal<boolean>

  constructor() {
    const options = inject(CANVAS_OPTIONS, { optional: true })
    const { onReady, ...coreOptions } = options ?? {}
    this.core = new AdrawCanvas(coreOptions)
    // Core defaults this to false; the Angular adapter documents `true`.
    this.core.setHideOverlayWhileTransforming(
      options?.hideOverlayWhileTransforming ?? true,
    )

    this.adrawStore = new AdrawStore(this.core, { onReady })
    this._snapshot = signal(this.adrawStore.getSnapshot())
    this.unsubscribe = this.adrawStore.subscribe(() => {
      this._snapshot.set(this.adrawStore.getSnapshot())
    })

    this.snapshot = this._snapshot.asReadonly()
    this.elements = computed(() => this._snapshot().elements)
    this.selectedElements = computed(() => this._snapshot().selectedElements)
    this.viewport = computed(() => this._snapshot().viewport)
    this.activeTool = computed(() => this._snapshot().tool)
    this.selectedIds = computed(() => this._snapshot().selectedIds)
    this.hideWhileTransforming = computed(
      () => this._snapshot().hideWhileTransforming,
    )
    this.style = computed(() => this._snapshot().style)
    this.snapping = computed(() => this._snapshot().snapping)
    this.isSnapMode = computed(() => this._snapshot().isSnapMode)
    this.isToolLocked = computed(() => this._snapshot().isToolLocked)
    this.isReady = computed(() => this._snapshot().isReady)
    this.canUndo = computed(() => this._snapshot().canUndo)
    this.canRedo = computed(() => this._snapshot().canRedo)

    inject(DestroyRef).onDestroy(() => {
      this.unsubscribe()
      this.adrawStore.dispose()
      this.core.destroy()
    })
  }

  /** The underlying vanilla AdrawCanvas instance. */
  get instance(): AdrawCanvas {
    return this.core
  }

  /** The store backing the signals. */
  get store(): AdrawStore {
    return this.adrawStore
  }

  /**
   * Mount the canvas into a container element (called by `<adraw-canvas>`).
   * @param container Container element.
   */
  mount(container: HTMLElement): void {
    this.core.mount(container)
  }

  /**
   * Tear down the DOM adapter while keeping the engine (and its document)
   * available for a later remount.
   */
  unmount(): void {
    this.core.destroy()
  }

  /**
   * Set the active tool.
   * @param tool Tool identifier.
   */
  setTool(tool: ToolType): void {
    this.core.setActiveTool(tool)
  }

  /**
   * Set transform-overlay visibility.
   * @param hide Hide flag.
   */
  setHideWhileTransforming(hide: boolean): void {
    this.core.setHideOverlayWhileTransforming(hide)
  }

  /**
   * Set the global style and restyle the selection.
   * @param options Style options.
   */
  setStyle(options: StyleOptions): void {
    this.core.setStyle(options)
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
