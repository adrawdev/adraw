import {
  type AdrawCanvas,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"

import { useCanvas } from "./context.svelte.ts"

export { useCanvas } from "./context.svelte.ts"

/**
 * State returned by {@link useCanvasEngine}.
 */
export interface CanvasEngineState {
  /** Engine owned by the nearest `CanvasProvider`. */
  engine: AdrawCanvas
  /** Reactive `true` after `<Canvas>` mounts the engine. */
  readonly isReady: boolean
}

/**
 * Access the engine and a reactive readiness flag.
 *
 * The engine exists as soon as the provider is created, so it can be used
 * during component setup without waiting for `<Canvas>` to mount. Read
 * `isReady` before DOM-dependent work such as `toImage()`.
 *
 * @returns `{ engine, isReady }`.
 */
export function useCanvasEngine(): CanvasEngineState {
  const context = useCanvas()
  return {
    engine: context.instance.current,
    get isReady() {
      return context.isReady
    },
  }
}

/**
 * Access the active tool and a setter.
 * @returns `{ tool, setTool }`.
 */
export function useTool() {
  const context = useCanvas()

  return {
    setTool: (tool: ToolType) => {
      context.instance.current.setActiveTool(tool)
    },
    get tool() {
      return context.state.activeTool
    },
  }
}

/** Access viewport state and zoom/pan helpers. */
export function useViewport() {
  const context = useCanvas()

  return {
    resetZoom: () => context.instance.current.resetZoom(),
    setViewport: (viewport: ViewportState) => {
      context.instance.current.setViewport(viewport)
    },
    get viewport() {
      return context.state.viewport
    },
    zoomIn: () => context.instance.current.zoomIn(),
    zoomOut: () => context.instance.current.zoomOut(),
    zoomToFit: (options?: ZoomToFitOptions) =>
      context.instance.current.zoomToFit(options),
  }
}

/** Access undo/redo operations and availability. */
export function useHistory() {
  const context = useCanvas()

  return {
    canRedo: () => context.instance.current.canRedo() ?? false,
    canUndo: () => context.instance.current.canUndo() ?? false,
    redo: () => context.instance.current.redo() ?? false,
    undo: () => context.instance.current.undo() ?? false,
  }
}

/** Access and control the transform-overlay visibility. */
export function useTransformOverlay() {
  const context = useCanvas()

  return {
    get hideWhileTransforming() {
      return context.state.hideWhileTransforming
    },
    setHideWhileTransforming: (hide: boolean) => {
      context.instance.current.setHideOverlayWhileTransforming(hide)
      context.state.hideWhileTransforming = hide
    },
  }
}

/** Access selection state and selection operations. */
export function useSelection() {
  const context = useCanvas()

  return {
    clearSelection: () => context.instance.current.clearSelection(),
    deleteSelected: () => context.instance.current.deleteSelected(),
    get elements() {
      return context.state.elements
    },
    selectAll: () => context.instance.current.selectAll(),
    get selectedIds() {
      return context.state.selectedIds
    },
  }
}
