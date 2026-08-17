"use client"

import {
  type AdrawCanvas,
  type CanvasElement,
  type ElementId,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import React, { createContext, useCallback, useContext } from "react"

import type { CanvasReactOptions } from "./components"

export interface CanvasContextValue {
  vanillaRef: React.RefObject<AdrawCanvas | null>
  elements: Map<ElementId, CanvasElement>
  setElements: React.Dispatch<React.SetStateAction<Map<string, CanvasElement>>>
  viewport: ViewportState
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>
  activeTool: ToolType
  setActiveTool: React.Dispatch<React.SetStateAction<ToolType>>
  selectedIds: Set<ElementId>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  hideWhileTransforming: boolean
  setHideWhileTransforming: React.Dispatch<React.SetStateAction<boolean>>
  options?: CanvasReactOptions
  setOptions: React.Dispatch<
    React.SetStateAction<CanvasReactOptions | undefined>
  >
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
  const { vanillaRef, activeTool, setActiveTool } = useCanvas()

  const setTool = useCallback(
    (tool: ToolType) => {
      vanillaRef?.current?.setActiveTool(tool)
      setActiveTool(tool)
    },
    [vanillaRef, setActiveTool],
  )

  return { setTool, tool: activeTool }
}

export function useViewport() {
  const { vanillaRef, viewport } = useCanvas()

  const setViewport = useCallback(
    (newViewport: ViewportState) => {
      vanillaRef?.current?.setViewport(newViewport)
    },
    [vanillaRef],
  )

  const zoomIn = useCallback(() => {
    vanillaRef?.current?.zoomIn()
  }, [vanillaRef])

  const zoomOut = useCallback(() => {
    vanillaRef?.current?.zoomOut()
  }, [vanillaRef])

  const resetZoom = useCallback(() => {
    vanillaRef?.current?.resetZoom()
  }, [vanillaRef])

  const zoomToFit = useCallback(() => {
    vanillaRef?.current?.zoomToFit()
  }, [vanillaRef])

  return {
    resetZoom,
    setViewport,
    viewport,
    zoomIn,
    zoomOut,
    zoomToFit,
  }
}

export function useHistory() {
  const { vanillaRef } = useCanvas()

  const undo = useCallback(
    () => vanillaRef?.current?.undo() ?? false,
    [vanillaRef],
  )

  const redo = useCallback(
    () => vanillaRef?.current?.redo() ?? false,
    [vanillaRef],
  )

  const canUndo = useCallback(
    () => vanillaRef?.current?.canUndo() ?? false,
    [vanillaRef],
  )

  const canRedo = useCallback(
    () => vanillaRef?.current?.canRedo() ?? false,
    [vanillaRef],
  )

  return { canRedo, canUndo, redo, undo }
}

export function useSelection() {
  const { vanillaRef, selectedIds, elements } = useCanvas()

  const selectAll = useCallback(() => {
    vanillaRef?.current?.selectAll()
  }, [vanillaRef])

  const clearSelection = useCallback(() => {
    vanillaRef?.current?.clearSelection()
  }, [vanillaRef])

  const deleteSelected = useCallback(() => {
    vanillaRef?.current?.deleteSelected()
  }, [vanillaRef])

  return {
    clearSelection,
    deleteSelected,
    elements,
    selectAll,
    selectedIds,
  }
}

export function useTransformOverlay() {
  const { vanillaRef, hideWhileTransforming, setHideWhileTransforming } =
    useCanvas()

  const setHide = useCallback(
    (hide: boolean) => {
      vanillaRef?.current?.setHideOverlayWhileTransforming(hide)
      setHideWhileTransforming(hide)
    },
    [vanillaRef, setHideWhileTransforming],
  )

  return { hideWhileTransforming, setHideWhileTransforming: setHide }
}
