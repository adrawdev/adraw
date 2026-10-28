import {
  AdrawCanvas,
  AdrawStore,
  type AdrawSnapshot,
  type CanvasElement,
  type CanvasOptions,
  type ElementId,
  type SnappingConfig,
  type StyleOptions,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import { getContext, setContext } from "svelte"

/**
 * Svelte-specific canvas options. Currently an alias of {@link CanvasOptions};
 * initial content is configured through `initialElements` / `initialDocument`.
 */
export interface CanvasSvelteOptions extends CanvasOptions {}

/**
 * Reactive adapter state projected from an AdrawSnapshot.
 */
export interface CanvasState {
  elements: ReadonlyMap<ElementId, CanvasElement>
  selectedElements: readonly CanvasElement[]
  viewport: ViewportState
  activeTool: ToolType
  selectedIds: ReadonlySet<ElementId>
  hideWhileTransforming: boolean
  style: StyleOptions
  snapping: SnappingConfig
  isSnapMode: boolean
  isToolLocked: boolean
  canUndo: boolean
  canRedo: boolean
}

/**
 * Svelte context value holding the canvas state.
 */
export interface CanvasContextValue {
  instance: { current: AdrawCanvas }
  store: AdrawStore
  /** Current immutable snapshot; reading it in a template or derived value is reactive. */
  readonly snapshot: AdrawSnapshot
  options?: CanvasSvelteOptions
  state: CanvasState
  /** `true` after `<Canvas>` mounts the engine. */
  readonly isReady: boolean
  /** Release the store subscription; called by `CanvasProvider` on destroy. */
  dispose: () => void
}

const CANVAS_CONTEXT_KEY = Symbol("adraw-canvas")

function stateFromSnapshot(snapshot: AdrawSnapshot): CanvasState {
  return {
    activeTool: snapshot.tool,
    canRedo: snapshot.canRedo,
    canUndo: snapshot.canUndo,
    elements: snapshot.elements,
    hideWhileTransforming: snapshot.hideWhileTransforming,
    isSnapMode: snapshot.isSnapMode,
    isToolLocked: snapshot.isToolLocked,
    selectedElements: snapshot.selectedElements,
    selectedIds: snapshot.selectedIds,
    snapping: snapshot.snapping,
    style: snapshot.style,
    viewport: snapshot.viewport,
  }
}

/**
 * Create and provide a canvas context.
 *
 * The engine and store are created headlessly here, so descendants can use
 * them during setup without waiting for `<Canvas>` to mount.
 *
 * @param getOptions Reactive accessor for options.
 * @param getOnReady Optional accessor for the ready callback.
 * @returns The provided context value.
 */
export function createCanvasContext(
  getOptions?: () => CanvasSvelteOptions | undefined,
  getOnReady?: () => ((engine: AdrawCanvas) => void) | undefined,
): CanvasContextValue {
  const options = getOptions?.()
  const engine = new AdrawCanvas(options ?? {})
  // Core defaults this to false; the Svelte adapter documents `true`.
  engine.setHideOverlayWhileTransforming(
    options?.hideOverlayWhileTransforming ?? true,
  )

  const store = new AdrawStore(engine, {
    onReady: (readyEngine) => getOnReady?.()?.(readyEngine),
  })
  let snapshot = $state.raw<AdrawSnapshot>(store.getSnapshot())
  const state = $state<CanvasState>(stateFromSnapshot(store.getSnapshot()))

  const unsubscribe = store.subscribe(() => {
    const next = store.getSnapshot()
    snapshot = next
    Object.assign(state, stateFromSnapshot(next))
  })

  const value: CanvasContextValue = {
    dispose: () => {
      unsubscribe()
      store.dispose()
    },
    instance: { current: engine },
    get isReady() {
      return snapshot.isReady
    },
    get options() {
      return getOptions?.()
    },
    get snapshot() {
      return snapshot
    },
    state,
    store,
  }

  setContext(CANVAS_CONTEXT_KEY, value)

  return value
}

/**
 * Resolve the nearest canvas context.
 * @throws When used outside a `CanvasProvider`.
 */
export function useCanvas(): CanvasContextValue {
  const context = getContext<CanvasContextValue | undefined>(CANVAS_CONTEXT_KEY)

  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider")
  }

  return context
}
