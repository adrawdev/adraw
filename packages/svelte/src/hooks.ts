import type { ToolType, ViewportState } from "@adraw/core"

import { useCanvas } from "./context.svelte.ts"

export { useCanvas } from "./context.svelte.ts"

/**
 * Access the active tool and a setter.
 * @returns `{ tool, setTool }`.
 */
export function useTool() {
  const context = useCanvas()

  return {
    setTool: (tool: ToolType) => {
      context.instance.current?.setActiveTool(tool)
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
    resetZoom: () => context.instance.current?.resetZoom(),
    setViewport: (viewport: ViewportState) => {
      context.instance.current?.setViewport(viewport)
    },
    get viewport() {
      return context.state.viewport
    },
    zoomIn: () => context.instance.current?.zoomIn(),
    zoomOut: () => context.instance.current?.zoomOut(),
    zoomToFit: () => context.instance.current?.zoomToFit(),
  }
}

/** Access undo/redo operations and availability. */
export function useHistory() {
  const context = useCanvas()

  return {
    canRedo: () => context.instance.current?.canRedo() ?? false,
    canUndo: () => context.instance.current?.canUndo() ?? false,
    redo: () => context.instance.current?.redo() ?? false,
    undo: () => context.instance.current?.undo() ?? false,
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
      context.instance.current?.setHideOverlayWhileTransforming(hide)
      context.state.hideWhileTransforming = hide
    },
  }
}

/** Access selection state and selection operations. */
export function useSelection() {
  const context = useCanvas()

  return {
    clearSelection: () => context.instance.current?.clearSelection(),
    deleteSelected: () => context.instance.current?.deleteSelected(),
    get elements() {
      return context.state.elements
    },
    selectAll: () => context.instance.current?.selectAll(),
    get selectedIds() {
      return context.state.selectedIds
    },
  }
}
