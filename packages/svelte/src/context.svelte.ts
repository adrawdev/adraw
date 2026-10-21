import {
  type AdrawCanvas,
  type CanvasElement,
  type CanvasOptions,
  type ElementId,
  resolveAllToolOptions,
  type ToolOptionsState,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import { getContext, setContext } from "svelte"

/**
 * Svelte-specific canvas options; currently an alias of {@link CanvasOptions}.
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
  toolOptions: ToolOptionsState
}

/**
 * Svelte context value holding the canvas state.
 */
export interface CanvasContextValue {
  instance: { current: AdrawCanvas | null }
  options?: CanvasSvelteOptions
  state: CanvasState
}

const CANVAS_CONTEXT_KEY = Symbol("adraw-canvas")

/**
 * Create and provide a canvas context.
 *
 * @param getOptions Reactive accessor for options.
 * @returns The provided context value.
 */
export function createCanvasContext(
  getOptions?: () => CanvasSvelteOptions | undefined,
): CanvasContextValue {
  const state = $state<CanvasState>({
    activeTool: "select",
    elements: new Map(),
    hideWhileTransforming: getOptions?.()?.hideOverlayWhileTransforming ?? true,
    selectedIds: new Set(),
    toolOptions: resolveAllToolOptions(getOptions?.()?.tools),
    viewport: { x: 0, y: 0, zoom: 1 },
  })

  const value: CanvasContextValue = {
    instance: { current: null },
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
