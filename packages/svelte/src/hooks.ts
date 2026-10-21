import {
  type AdrawCanvas,
  inferConfigurableTool,
  type ConfigurableToolType,
  type ResolvedToolOptions,
  type ToolOptionsMap,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"

import { useCanvas } from "./context.svelte.ts"

/** Merge partial style options into a tool's current options. */
export type SetToolOptions = <T extends ConfigurableToolType>(
  tool: T,
  options: ToolOptionsMap[T],
) => void

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

/**
 * Access resolved style options for every configurable tool and a setter.
 *
 * @returns `{ toolOptions, setToolOptions }` with reactive getters.
 */
export function useToolOptions() {
  const context = useCanvas()

  function setToolOptions<T extends ConfigurableToolType>(
    tool: T,
    options: ToolOptionsMap[T],
  ): void {
    context.instance.current.setToolOptions(tool, options)
  }

  return {
    setToolOptions,
    get toolOptions() {
      return context.state.toolOptions
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
  const context = useCanvas()

  const resolvedTool = () =>
    tool ??
    inferConfigurableTool(
      context.state.activeTool,
      context.state.elements,
      context.state.selectedIds,
    )

  return {
    setStyle: (options: ToolOptionsMap[ConfigurableToolType]) => {
      const current = resolvedTool()
      if (current) {
        context.instance.current.setToolOptions(current, options)
      }
    },
    get style() {
      const current = resolvedTool()
      return current ? context.state.toolOptions[current] : null
    },
    get tool() {
      return resolvedTool()
    },
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
