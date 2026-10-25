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
  /** Monotonic revision. Increments only when the snapshot changes. */
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

    this.unsubscribeFromEngine = subscribeState(engine, (kind) => {
      this.handleStateChange(kind)
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

  private handleStateChange(kind: StateChangeKind): void {
    if (this.disposed) {
      return
    }
    const next = this.updateSnapshot(kind)
    if (!next) {
      return
    }

    this.snapshot = next
    for (const listener of this.listeners) {
      listener()
    }
    if (next.isReady && !this.readyNotified) {
      this.notifyReady()
    }
  }

  private notifyReady(): void {
    if (this.readyNotified) {
      return
    }
    this.readyNotified = true
    this.onReady?.(this.engine as AdrawCanvas)
  }

  private updateSnapshot(kind: StateChangeKind): AdrawSnapshot | null {
    const previous = this.snapshot

    switch (kind) {
      case "elements": {
        const elements = new Map(this.engine.getElements())
        return this.next(previous, {
          canRedo: this.engine.canRedo(),
          canUndo: this.engine.canUndo(),
          elements,
          selectedElements: selectElements(elements, previous.selectedIds),
          style: this.engine.getStyle(),
        })
      }
      case "selection": {
        const selectedIds = new Set(this.engine.getSelectedIds())
        if (sameSet(previous.selectedIds, selectedIds)) {
          return null
        }
        return this.next(previous, {
          canRedo: this.engine.canRedo(),
          canUndo: this.engine.canUndo(),
          selectedElements: selectElements(previous.elements, selectedIds),
          selectedIds,
          style: this.engine.getStyle(),
        })
      }
      case "viewport": {
        const viewport = { ...this.engine.getViewport() }
        if (sameViewport(previous.viewport, viewport)) {
          return null
        }
        return this.next(previous, { viewport })
      }
      case "tool": {
        const tool = this.engine.getActiveTool()
        if (tool === previous.tool) {
          return null
        }
        return this.next(previous, { tool })
      }
      case "style": {
        const style = this.engine.getStyle()
        if (sameStyle(previous.style, style)) {
          return null
        }
        return this.next(previous, { style })
      }
      case "snapping": {
        const snapping = { ...this.engine.getSnappingConfig() }
        const isSnapMode = this.engine.getIsSnapMode()
        if (
          sameSnapping(previous.snapping, snapping) &&
          isSnapMode === previous.isSnapMode
        ) {
          return null
        }
        return this.next(previous, { isSnapMode, snapping })
      }
      case "toolLock": {
        const isToolLocked = this.engine.getIsToolLocked()
        if (isToolLocked === previous.isToolLocked) {
          return null
        }
        return this.next(previous, { isToolLocked })
      }
      case "overlay": {
        const hideWhileTransforming =
          this.engine.getHideOverlayWhileTransforming()
        if (hideWhileTransforming === previous.hideWhileTransforming) {
          return null
        }
        return this.next(previous, { hideWhileTransforming })
      }
      case "history": {
        const canUndo = this.engine.canUndo()
        const canRedo = this.engine.canRedo()
        if (canUndo === previous.canUndo && canRedo === previous.canRedo) {
          return null
        }
        return this.next(previous, { canRedo, canUndo })
      }
      case "mount": {
        const isReady = this.engine.isMounted()
        if (isReady === previous.isReady) {
          return null
        }
        return this.next(previous, { isReady })
      }
    }
  }

  private next(
    previous: AdrawSnapshot,
    patch: Partial<AdrawSnapshot>,
  ): AdrawSnapshot {
    return {
      ...previous,
      ...patch,
      revision: previous.revision + 1,
    }
  }
}
