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

/**
 * React context value synced with an adraw canvas instance.
 */
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

/**
 * React context holding the canvas state.
 */
export const CanvasContext = createContext<CanvasContextValue | null>(null)

/**
 * Resolve the nearest {@link CanvasProvider} context.
 * Must be called within a `CanvasProvider`.
 *
 * @throws When used outside a `CanvasProvider`.
 */
export function useCanvas() {
  const context = useContext(CanvasContext)
  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider")
  }
  return context
}

/**
 * Access the active tool and a setter.
 *
 * @returns `{ tool, setTool }`.
 */
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

/**
 * Access viewport state and zoom/pan helpers.
 */
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

/**
 * Access undo/redo operations and availability.
 */
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

/**
 * Access selection state and selection operations.
 */
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

/**
 * Access and control the transform-overlay visibility.
 */
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
