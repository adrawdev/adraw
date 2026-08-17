import {
  type AdrawCanvas,
  type CanvasElement,
  type ElementId,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import { createContext, useContext, type Accessor, type Setter } from "solid-js"

import type { CanvasSolidOptions } from "./components"

export interface CanvasRef {
  current: AdrawCanvas | null
}

export interface CanvasContextValue {
  canvasRef: CanvasRef
  elements: Accessor<Map<ElementId, CanvasElement>>
  setElements: Setter<Map<ElementId, CanvasElement>>
  viewport: Accessor<ViewportState>
  setViewport: Setter<ViewportState>
  activeTool: Accessor<ToolType>
  setActiveTool: Setter<ToolType>
  selectedIds: Accessor<Set<ElementId>>
  setSelectedIds: Setter<Set<ElementId>>
  canUndo: Accessor<boolean>
  setCanUndo: Setter<boolean>
  canRedo: Accessor<boolean>
  setCanRedo: Setter<boolean>
  hideWhileTransforming: Accessor<boolean>
  setHideWhileTransforming: Setter<boolean>
  options?: CanvasSolidOptions
}

export const CanvasContext = createContext<CanvasContextValue | null>(null)

export function useCanvas() {
  const context = useContext(CanvasContext)
  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider")
  }
  return context
}

export function useTool() {
  const { canvasRef, activeTool } = useCanvas()

  return {
    setTool: (tool: ToolType) => {
      canvasRef.current?.setActiveTool(tool)
    },
    get tool() {
      return activeTool()
    },
  }
}

export function useViewport() {
  const { canvasRef, viewport } = useCanvas()

  return {
    resetZoom: () => canvasRef.current?.resetZoom(),
    setViewport: (newViewport: ViewportState) => {
      canvasRef.current?.setViewport(newViewport)
    },
    get viewport() {
      return viewport()
    },
    zoomIn: () => canvasRef.current?.zoomIn(),
    zoomOut: () => canvasRef.current?.zoomOut(),
    zoomToFit: () => canvasRef.current?.zoomToFit(),
  }
}

export function useHistory() {
  const { canvasRef, canUndo, canRedo } = useCanvas()

  return {
    canRedo: () => canRedo(),
    canUndo: () => canUndo(),
    redo: () => canvasRef.current?.redo() ?? false,
    undo: () => canvasRef.current?.undo() ?? false,
  }
}

export function useTransformOverlay() {
  const { canvasRef, hideWhileTransforming, setHideWhileTransforming } =
    useCanvas()

  return {
    get hideWhileTransforming() {
      return hideWhileTransforming()
    },
    setHideWhileTransforming: (hide: boolean) => {
      canvasRef.current?.setHideOverlayWhileTransforming(hide)
      setHideWhileTransforming(hide)
    },
  }
}

export function useSelection() {
  const { canvasRef, selectedIds, elements } = useCanvas()

  return {
    clearSelection: () => canvasRef.current?.clearSelection(),
    deleteSelected: () => canvasRef.current?.deleteSelected(),
    get elements() {
      return elements()
    },
    selectAll: () => canvasRef.current?.selectAll(),
    get selectedIds() {
      return selectedIds()
    },
  }
}
