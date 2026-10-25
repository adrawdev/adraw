"use client"

import {
  type AdrawCanvas,
  type AdrawSnapshot,
  type AdrawStore,
  type CanvasElement,
  type ElementId,
  type StyleOptions,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"
import React, { createContext, useCallback, useContext } from "react"

import type { CanvasReactOptions } from "./components"

/**
 * React context value synced with an adraw canvas instance.
 */
export interface CanvasContextValue {
  /** Underlying engine. Available as soon as the provider renders. */
  engine: AdrawCanvas
  /** Store owning the snapshot and subscriptions. */
  store: AdrawStore
  /** Current immutable snapshot. */
  snapshot: AdrawSnapshot
  /**
   * `true` once `<Canvas>` has mounted the engine.
   */
  isReady: boolean
  /**
   * Ref to the underlying engine, kept for backwards compatibility.
   * Prefer {@link useCanvasEngine}, which is populated synchronously.
   */
  vanillaRef: React.RefObject<AdrawCanvas | null>
  elements: ReadonlyMap<ElementId, CanvasElement>
  setElements: (elements: Map<ElementId, CanvasElement>) => void
  viewport: ViewportState
  setViewport: (viewport: ViewportState) => void
  activeTool: ToolType
  setActiveTool: (tool: ToolType) => void
  selectedIds: ReadonlySet<ElementId>
  setSelectedIds: (ids: Set<ElementId>) => void
  hideWhileTransforming: boolean
  setHideWhileTransforming: (hide: boolean) => void
  /** Selection style when there is a selection, otherwise the global style. */
  style: StyleOptions
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
 * State returned by {@link useCanvasEngine}.
 */
export interface CanvasEngineState {
  /** Engine instance owned by the nearest `CanvasProvider`. */
  engine: AdrawCanvas
  /**
   * `true` once `<Canvas>` has mounted the engine. Wait for this before
   * DOM-dependent work such as `toImage()`.
   */
  isReady: boolean
}

/**
 * Access the underlying engine without relying on effect ordering or a ref
 * being populated.
 *
 * The engine exists as soon as `CanvasProvider` renders, so effects, event
 * handlers and render-time callbacks can use it immediately. Use `isReady`
 * (which toggles a re-render) before doing DOM-dependent work.
 *
 * @returns `{ engine, isReady }`.
 * @example
 * ```tsx
 * function ExportButton() {
 *   const { engine, isReady } = useCanvasEngine()
 *
 *   return (
 *     <button
 *       disabled={!isReady}
 *       onClick={() => engine.toImage().then(download)}
 *     >
 *       Export
 *     </button>
 *   )
 * }
 * ```
 */
export function useCanvasEngine(): CanvasEngineState {
  const { engine, isReady } = useCanvas()
  return { engine, isReady }
}

/**
 * Access the active tool and a setter.
 *
 * @returns `{ tool, setTool }`.
 */
export function useTool() {
  const { engine, activeTool } = useCanvas()

  const setTool = useCallback(
    (tool: ToolType) => {
      engine.setActiveTool(tool)
    },
    [engine],
  )

  return { setTool, tool: activeTool }
}

/**
 * Access viewport state and zoom/pan helpers.
 */
export function useViewport() {
  const { engine, viewport } = useCanvas()

  const setViewport = useCallback(
    (newViewport: ViewportState) => {
      engine.setViewport(newViewport)
    },
    [engine],
  )

  const zoomIn = useCallback(() => {
    engine.zoomIn()
  }, [engine])

  const zoomOut = useCallback(() => {
    engine.zoomOut()
  }, [engine])

  const resetZoom = useCallback(() => {
    engine.resetZoom()
  }, [engine])

  const zoomToFit = useCallback(
    (options?: ZoomToFitOptions) => {
      engine.zoomToFit(options)
    },
    [engine],
  )

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
  const { engine, snapshot } = useCanvas()

  const undo = useCallback(() => engine.undo(), [engine])

  const redo = useCallback(() => engine.redo(), [engine])

  const canUndo = useCallback(() => snapshot.canUndo, [snapshot.canUndo])

  const canRedo = useCallback(() => snapshot.canRedo, [snapshot.canRedo])

  return { canRedo, canUndo, redo, undo }
}

/**
 * Access selection state and selection operations.
 */
export function useSelection() {
  const { engine, selectedIds, snapshot } = useCanvas()

  const selectAll = useCallback(() => {
    engine.selectAll()
  }, [engine])

  const clearSelection = useCallback(() => {
    engine.clearSelection()
  }, [engine])

  const deleteSelected = useCallback(() => {
    engine.deleteSelected()
  }, [engine])

  return {
    clearSelection,
    deleteSelected,
    elements: snapshot.selectedElements,
    selectAll,
    selectedIds,
  }
}

/**
 * Access and control the transform-overlay visibility.
 */
export function useTransformOverlay() {
  const { engine, hideWhileTransforming } = useCanvas()

  const setHide = useCallback(
    (hide: boolean) => {
      engine.setHideOverlayWhileTransforming(hide)
    },
    [engine],
  )

  return { hideWhileTransforming, setHideWhileTransforming: setHide }
}

/**
 * Access the current style and update the global/selected style.
 */
export function useStyle() {
  const { engine, style } = useCanvas()

  const setStyle = useCallback(
    (options: StyleOptions) => {
      engine.setStyle(options)
    },
    [engine],
  )

  return { setStyle, style }
}
