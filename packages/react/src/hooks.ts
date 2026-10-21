"use client"

import {
  type AdrawCanvas,
  type CanvasElement,
  type ConfigurableToolType,
  type ElementId,
  inferConfigurableTool,
  type ResolvedToolOptions,
  type ToolOptionsMap,
  type ToolOptionsState,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"
import React, { createContext, useCallback, useContext } from "react"

import type { CanvasReactOptions } from "./components"

/**
 * Merge partial style options into a tool's current options.
 */
export type SetToolOptions = <T extends ConfigurableToolType>(
  tool: T,
  options: ToolOptionsMap[T],
) => void

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
  toolOptions: ToolOptionsState
  setToolOptions: SetToolOptions
  /** @internal Mirror engine tool-style events into React state. */
  syncToolOptions: (
    tool: ConfigurableToolType,
    options: ResolvedToolOptions<ConfigurableToolType>,
  ) => void
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

  const zoomToFit = useCallback(
    (options?: ZoomToFitOptions) => {
      vanillaRef?.current?.zoomToFit(options)
    },
    [vanillaRef],
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
 * Access resolved style options for every configurable tool and a setter.
 * Useful when a toolbar exposes controls for several tools at once.
 *
 * @returns `{ toolOptions, setToolOptions }`.
 */
export function useToolOptions() {
  const { toolOptions, setToolOptions } = useCanvas()
  return { setToolOptions, toolOptions }
}

/** Result of {@link useStyle} when a tool is passed explicitly. */
export interface StyleResult<T extends ConfigurableToolType> {
  /** Tool whose style is exposed. */
  tool: T
  /** Resolved style options for the tool. */
  style: ResolvedToolOptions<T>
  /** Merge partial style options into the tool. */
  setStyle: (options: ToolOptionsMap[T]) => void
}

/** Result of {@link useStyle} when the tool is inferred. */
export interface InferredStyleResult {
  /** Inferred tool, or `null` when no tool applies (e.g. hand/select). */
  tool: ConfigurableToolType | null
  /** Resolved style options, or `null` when no tool applies. */
  style: ResolvedToolOptions<ConfigurableToolType> | null
  /** Merge partial style options into the inferred tool. No-op when null. */
  setStyle: (options: ToolOptionsMap[ConfigurableToolType]) => void
}

/**
 * Access the style of one drawing tool. Pass a tool explicitly for a fixed
 * style panel, or omit it to follow the current selection / active tool.
 *
 * @param tool Optional configurable tool. When omitted, the tool of a
 * homogeneous selection wins; otherwise the active tool is used when it has
 * style options.
 * @returns `{ tool, style, setStyle }`.
 * @example
 * ```tsx
 * const { style, setStyle } = useStyle("rectangle")
 * <input
 *   type="range"
 *   value={style.cornerRadius}
 *   onChange={(event) => setStyle({ cornerRadius: Number(event.target.value) })}
 * />
 * ```
 */
export function useStyle<T extends ConfigurableToolType>(
  tool: T,
): StyleResult<T>
export function useStyle(): InferredStyleResult
export function useStyle(
  tool?: ConfigurableToolType,
): StyleResult<ConfigurableToolType> | InferredStyleResult {
  const { activeTool, elements, selectedIds, toolOptions, setToolOptions } =
    useCanvas()

  const resolvedTool =
    tool ?? inferConfigurableTool(activeTool, elements, selectedIds)
  const style = resolvedTool ? toolOptions[resolvedTool] : null

  const setStyle = useCallback(
    (options: ToolOptionsMap[ConfigurableToolType]) => {
      if (resolvedTool) {
        setToolOptions(resolvedTool, options)
      }
    },
    [resolvedTool, setToolOptions],
  )

  return { setStyle, style, tool: resolvedTool }
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
