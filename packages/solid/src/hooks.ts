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
import { createContext, useContext, type Accessor, type Setter } from "solid-js"

import type { CanvasSolidOptions } from "./components"

/** Merge partial style options into a tool's current options. */
export type SetToolOptions = <T extends ConfigurableToolType>(
  tool: T,
  options: ToolOptionsMap[T],
) => void

/** Ref holding the mounted canvas instance. */
export interface CanvasRef {
  current: AdrawCanvas | null
}

/** Solid context value synced with an adraw canvas. */
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
  toolOptions: Accessor<ToolOptionsState>
  /** @internal Mirror engine tool-style events into Solid signals. */
  setToolOptions: Setter<ToolOptionsState>
  /** Update a tool's styles through the canvas (or mirrored state pre-mount). */
  updateToolOptions: SetToolOptions
  options?: CanvasSolidOptions
}

/** Solid context holding the canvas state. */
export const CanvasContext = createContext<CanvasContextValue | null>(null)

/**
 * Resolve the nearest `CanvasProvider` context.
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
 * @returns `{ tool, setTool }`.
 */
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

/** Access viewport state and zoom/pan helpers. */
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
    zoomToFit: (options?: ZoomToFitOptions) =>
      canvasRef.current?.zoomToFit(options),
  }
}

/** Access undo/redo operations and availability. */
export function useHistory() {
  const { canvasRef, canUndo, canRedo } = useCanvas()

  return {
    canRedo: () => canRedo(),
    canUndo: () => canUndo(),
    redo: () => canvasRef.current?.redo() ?? false,
    undo: () => canvasRef.current?.undo() ?? false,
  }
}

/**
 * Access resolved style options for every configurable tool and a setter.
 *
 * @returns `{ toolOptions, setToolOptions }` (`toolOptions` is a getter).
 */
export function useToolOptions() {
  const { toolOptions, updateToolOptions } = useCanvas()

  return {
    setToolOptions: updateToolOptions,
    get toolOptions() {
      return toolOptions()
    },
  }
}

/** Result of {@link useStyle} when a tool is passed explicitly. */
export interface StyleResult<T extends ConfigurableToolType> {
  /** Tool whose style is exposed. */
  get tool(): T
  /** Resolved style options for the tool. */
  get style(): ResolvedToolOptions<T>
  /** Merge partial style options into the tool. */
  setStyle: (options: ToolOptionsMap[T]) => void
}

/** Result of {@link useStyle} when the tool is inferred. */
export interface InferredStyleResult {
  /** Inferred tool, or `null` when no tool applies (e.g. hand/select). */
  get tool(): ConfigurableToolType | null
  /** Resolved style options, or `null` when no tool applies. */
  get style(): ResolvedToolOptions<ConfigurableToolType> | null
  /** Merge partial style options into the inferred tool. No-op when null. */
  setStyle: (options: ToolOptionsMap[ConfigurableToolType]) => void
}

/**
 * Access the style of one drawing tool. Pass a tool explicitly for a fixed
 * style panel, or omit it to follow the current selection / active tool.
 *
 * @param tool Optional configurable tool.
 * @returns `{ tool, style, setStyle }` with reactive getters.
 */
export function useStyle<T extends ConfigurableToolType>(
  tool: T,
): StyleResult<T>
export function useStyle(): InferredStyleResult
export function useStyle(
  tool?: ConfigurableToolType,
): StyleResult<ConfigurableToolType> | InferredStyleResult {
  const { activeTool, elements, selectedIds, toolOptions, updateToolOptions } =
    useCanvas()

  const resolvedTool = () =>
    tool ?? inferConfigurableTool(activeTool(), elements(), selectedIds())

  return {
    setStyle: (options: ToolOptionsMap[ConfigurableToolType]) => {
      const current = resolvedTool()
      if (current) {
        updateToolOptions(current, options)
      }
    },
    get style() {
      const current = resolvedTool()
      return current ? toolOptions()[current] : null
    },
    get tool() {
      return resolvedTool()
    },
  }
}

/** Access and control the transform-overlay visibility. */
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

/** Access selection state and selection operations. */
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
