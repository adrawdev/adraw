import type { AdrawCanvas } from "./canvas"
import type { CanvasEngine } from "./engine/engine"
import { subscribeState, type StateChangeKind } from "./engine/state-notifier"
import type { SnappingConfig } from "./snapping"
import type { StyleOptions } from "./style"
import type { CanvasElement, ElementId, ToolType, ViewportState } from "./types"

/**
 * A consistent, immutable view of canvas state at one revision. Framework
 * adapters read this through {@link AdrawStore.getSnapshot} and subscribe to
 * later revisions through {@link AdrawStore.subscribe}.
 */
export interface AdrawSnapshot {
  /**
   * Monotonic revision. Increments once per changed operation snapshot; stays
   * unchanged when an operation produces no observable change.
   */
  readonly revision: number
  /** Elements keyed by id. The map is copied when elements change. */
  readonly elements: ReadonlyMap<ElementId, CanvasElement>
  /** Selected element ids. The set is copied when selection changes. */
  readonly selectedIds: ReadonlySet<ElementId>
  /** Selected elements in selection order. */
  readonly selectedElements: readonly CanvasElement[]
  readonly viewport: ViewportState
  readonly tool: ToolType
  readonly canUndo: boolean
  readonly canRedo: boolean
  /** Selection style when there is a selection, otherwise the global style. */
  readonly style: StyleOptions
  readonly snapping: SnappingConfig
  readonly isSnapMode: boolean
  readonly isToolLocked: boolean
  readonly hideWhileTransforming: boolean
  /** `true` while the canvas is mounted into a DOM container. */
  readonly isReady: boolean
}

/**
 * Options for {@link AdrawStore}.
 */
export interface AdrawStoreOptions {
  /**
   * Called once per engine, when the canvas first becomes mounted. It is not
   * called again on remount; create a new store for a new engine.
   */
  onReady?: (engine: AdrawCanvas) => void
}

function selectElements(
  elements: ReadonlyMap<ElementId, CanvasElement>,
  selectedIds: ReadonlySet<ElementId>,
): CanvasElement[] {
  const selected: CanvasElement[] = []
  for (const id of selectedIds) {
    const element = elements.get(id)
    if (element) {
      selected.push(element)
    }
  }
  return selected
}

function sameElements(
  left: ReadonlyMap<ElementId, CanvasElement>,
  right: ReadonlyMap<ElementId, CanvasElement>,
): boolean {
  if (left === right) {
    return true
  }
  if (left.size !== right.size) {
    return false
  }
  for (const [id, element] of left) {
    if (right.get(id) !== element) {
      return false
    }
  }
  return true
}

function sameSet(
  left: ReadonlySet<ElementId>,
  right: ReadonlySet<ElementId>,
): boolean {
  if (left === right) {
    return true
  }
  if (left.size !== right.size) {
    return false
  }
  for (const id of left) {
    if (!right.has(id)) {
      return false
    }
  }
  return true
}

function sameViewport(left: ViewportState, right: ViewportState): boolean {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom
}

function sameStyle(left: StyleOptions, right: StyleOptions): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    if (
      (left as Record<string, unknown>)[key] !==
      (right as Record<string, unknown>)[key]
    ) {
      return false
    }
  }
  return true
}

function sameSnapping(left: SnappingConfig, right: SnappingConfig): boolean {
  return left.threshold === right.threshold
}

/**
 * Adapter-facing state module. It mirrors an engine into an {@link AdrawSnapshot},
 * copies changed slices, suppresses no-op changes and notifies framework
 * adapters through {@link AdrawStore.subscribe}.
 *
 * One completed canvas operation publishes at most one snapshot. Every
 * snapshot is internally coherent: selected ids resolve against `elements`,
 * `selectedElements` follows selection order, and unchanged slices keep their
 * previous references.
 *
 * Each adapter owns one store per engine and calls {@link AdrawStore.dispose}
 * when the provider or service is torn down.
 *
 * @example
 * ```ts
 * const store = new AdrawStore(canvas, { onReady: startToolbar })
 * const snapshot = store.getSnapshot()
 * const unsubscribe = store.subscribe(() => render(store.getSnapshot()))
 * unsubscribe()
 * store.dispose()
 * ```
 */
export class AdrawStore {
  private readonly engine: CanvasEngine
  private readonly onReady?: (engine: AdrawCanvas) => void
  private readonly unsubscribeFromEngine: () => void
  private listeners = new Set<() => void>()
  private snapshot: AdrawSnapshot
  private readyNotified = false
  private disposed = false

  constructor(engine: CanvasEngine, options: AdrawStoreOptions = {}) {
    this.engine = engine
    this.onReady = options.onReady

    const elements = new Map(engine.getElements())
    const selectedIds = new Set(engine.getSelectedIds())
    this.snapshot = {
      canRedo: engine.canRedo(),
      canUndo: engine.canUndo(),
      elements,
      hideWhileTransforming: engine.getHideOverlayWhileTransforming(),
      isReady: engine.isMounted(),
      isSnapMode: engine.getIsSnapMode(),
      isToolLocked: engine.getIsToolLocked(),
      revision: 0,
      selectedElements: selectElements(elements, selectedIds),
      selectedIds,
      snapping: { ...engine.getSnappingConfig() },
      style: engine.getStyle(),
      tool: engine.getActiveTool(),
      viewport: { ...engine.getViewport() },
    }

    this.unsubscribeFromEngine = subscribeState(engine, (kinds) => {
      this.handleStateChange(kinds)
    })

    if (this.snapshot.isReady) {
      this.notifyReady()
    }
  }

  /**
   * The latest snapshot. The object is stable until the next change.
   */
  getSnapshot = (): AdrawSnapshot => this.snapshot

  /**
   * Subscribe to snapshot changes. Returns an unsubscribe function.
   *
   * The listener runs synchronously, at most once per completed canvas
   * operation, after a new snapshot is available. No-op operations do not
   * notify.
   *
   * @param listener Called after a new snapshot is available.
   */
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) {
      return () => {}
    }
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Stop listening to the engine. The last snapshot remains readable.
   */
  dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.unsubscribeFromEngine()
    this.listeners.clear()
  }

  private handleStateChange(kinds: ReadonlySet<StateChangeKind>): void {
    if (this.disposed) {
      return
    }
    const next = this.updateSnapshot(kinds)
    if (!next) {
      return
    }

    this.snapshot = next
    let failed = false
    let failure: unknown
    const currentListeners = new Set(this.listeners)
    for (const listener of currentListeners) {
      try {
        listener()
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
    }
    if (next.isReady && !this.readyNotified) {
      try {
        this.notifyReady()
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
    }
    if (failed) {
      throw failure
    }
  }

  private notifyReady(): void {
    if (this.readyNotified) {
      return
    }
    this.readyNotified = true
    this.onReady?.(this.engine as AdrawCanvas)
  }

  private updateSnapshot(
    kinds: ReadonlySet<StateChangeKind>,
  ): AdrawSnapshot | null {
    const previous = this.snapshot
    const elementsChanged = kinds.has("elements")
    const selectionTouched = elementsChanged || kinds.has("selection")

    let elements = previous.elements
    if (elementsChanged) {
      const currentElements = this.engine.getElements()
      if (!sameElements(previous.elements, currentElements)) {
        elements = new Map(currentElements)
      }
    }

    let selectedIds = previous.selectedIds
    if (selectionTouched) {
      const currentSelectedIds = this.engine.getSelectedIds()
      if (!sameSet(previous.selectedIds, currentSelectedIds)) {
        selectedIds = new Set(currentSelectedIds)
      }
    }

    let selectedElements = previous.selectedElements
    if (
      selectionTouched &&
      (elements !== previous.elements || selectedIds !== previous.selectedIds)
    ) {
      selectedElements = selectElements(elements, selectedIds)
    }

    let style = previous.style
    if (selectionTouched || kinds.has("style")) {
      const currentStyle = this.engine.getStyle()
      if (!sameStyle(previous.style, currentStyle)) {
        style = currentStyle
      }
    }

    let canUndo = previous.canUndo
    let canRedo = previous.canRedo
    if (elementsChanged || kinds.has("history")) {
      canUndo = this.engine.canUndo()
      canRedo = this.engine.canRedo()
    }

    let viewport = previous.viewport
    if (kinds.has("viewport")) {
      const currentViewport = { ...this.engine.getViewport() }
      if (!sameViewport(previous.viewport, currentViewport)) {
        viewport = currentViewport
      }
    }

    let tool = previous.tool
    if (kinds.has("tool")) {
      tool = this.engine.getActiveTool()
    }

    let snapping = previous.snapping
    let isSnapMode = previous.isSnapMode
    if (kinds.has("snapping")) {
      const currentSnapping = { ...this.engine.getSnappingConfig() }
      const currentSnapMode = this.engine.getIsSnapMode()
      if (!sameSnapping(previous.snapping, currentSnapping)) {
        snapping = currentSnapping
      }
      isSnapMode = currentSnapMode
    }

    let isToolLocked = previous.isToolLocked
    if (kinds.has("toolLock")) {
      isToolLocked = this.engine.getIsToolLocked()
    }

    let hideWhileTransforming = previous.hideWhileTransforming
    if (kinds.has("overlay")) {
      hideWhileTransforming = this.engine.getHideOverlayWhileTransforming()
    }

    let isReady = previous.isReady
    if (kinds.has("mount")) {
      isReady = this.engine.isMounted()
    }

    const changed =
      elements !== previous.elements ||
      selectedIds !== previous.selectedIds ||
      selectedElements !== previous.selectedElements ||
      style !== previous.style ||
      canUndo !== previous.canUndo ||
      canRedo !== previous.canRedo ||
      viewport !== previous.viewport ||
      tool !== previous.tool ||
      snapping !== previous.snapping ||
      isSnapMode !== previous.isSnapMode ||
      isToolLocked !== previous.isToolLocked ||
      hideWhileTransforming !== previous.hideWhileTransforming ||
      isReady !== previous.isReady

    if (!changed) {
      return null
    }

    return {
      ...previous,
      canRedo,
      canUndo,
      elements,
      hideWhileTransforming,
      isReady,
      isSnapMode,
      isToolLocked,
      revision: previous.revision + 1,
      selectedElements,
      selectedIds,
      snapping,
      style,
      tool,
      viewport,
    }
  }
}
