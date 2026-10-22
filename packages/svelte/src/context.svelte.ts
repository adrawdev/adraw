import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasOptions,
  type ElementId,
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
 * Reactive state synced with an adraw canvas.
 */
export interface CanvasState {
  elements: Map<ElementId, CanvasElement>
  viewport: ViewportState
  activeTool: ToolType
  selectedIds: Set<ElementId>
  hideWhileTransforming: boolean
}

/**
 * Svelte context value holding the canvas state.
 */
export interface CanvasContextValue {
  instance: { current: AdrawCanvas }
  options?: CanvasSvelteOptions
  state: CanvasState
  /** `true` after `<Canvas>` mounts the engine. */
  readonly isReady: boolean
  /** @internal Called by `<Canvas>` after mounting the engine. */
  notifyReady: () => void
  /** @internal Called by `<Canvas>` when its DOM adapter unmounts. */
  markUnmounted: () => void
}

const CANVAS_CONTEXT_KEY = Symbol("adraw-canvas")

/**
 * Create and provide a canvas context.
 *
 * The engine is created headlessly here, so descendants can use it during
 * setup without waiting for `<Canvas>` to mount.
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
  let isReady = $state(false)
  let readyNotified = false

  const state = $state<CanvasState>({
    activeTool: engine.getActiveTool(),
    elements: new Map(engine.getElements()),
    hideWhileTransforming: engine.getHideOverlayWhileTransforming(),
    selectedIds: new Set(engine.getSelectedIds()),
    viewport: engine.getViewport(),
  })

  engine.on("change", ({ elements }) => {
    state.elements = new Map(elements)
  })

  engine.on("viewportChange", ({ viewport }) => {
    state.viewport = viewport
  })

  engine.on("toolChange", ({ tool }) => {
    state.activeTool = tool
  })

  engine.on("selectionChange", ({ selectedIds }) => {
    state.selectedIds = new Set(selectedIds)
  })

  const value: CanvasContextValue = {
    instance: { current: engine },
    get isReady() {
      return isReady
    },
    markUnmounted: () => {
      isReady = false
    },
    notifyReady: () => {
      isReady = true
      if (!readyNotified) {
        readyNotified = true
        getOnReady?.()?.(engine)
      }
    },
    get options() {
      return getOptions?.()
    },
    state,
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
