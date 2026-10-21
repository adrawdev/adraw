import {
  inferConfigurableTool,
  type ConfigurableToolType,
  type ResolvedToolOptions,
  type ToolOptionsMap,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"
import { computed, inject, type Signal } from "@angular/core"

import { CanvasService } from "./canvas.service"

/** Merge partial style options into a tool's current options. */
export type SetToolOptions = <T extends ConfigurableToolType>(
  tool: T,
  options: ToolOptionsMap[T],
) => void

// Injectable "hooks" mirroring the useCanvas/useTool/useViewport/useHistory/
// useSelection surface shared by every adraw adapter. Each must be called in
// an Angular injection context (a constructor or field initializer) so
// inject() can resolve the CanvasService provided by provideCanvas().
//
// Reactive values are returned as Angular signals — Angular's reactivity
// primitive, the analog of Solid's accessors — so read them by calling them
// (e.g. `tool()`), including inside templates.

/** Resolve the component-scoped `CanvasService`. */
export function useCanvas(): CanvasService {
  return inject(CanvasService)
}

/** Access the active tool signal and setter. */
export function useTool() {
  const canvas = inject(CanvasService)
  return {
    setTool: (tool: ToolType) => canvas.setTool(tool),
    tool: canvas.activeTool,
  }
}

/** Access viewport state and zoom/pan helpers. */
export function useViewport() {
  const canvas = inject(CanvasService)
  return {
    resetZoom: () => canvas.resetZoom(),
    setViewport: (viewport: ViewportState) => canvas.setViewport(viewport),
    viewport: canvas.viewport,
    zoomIn: () => canvas.zoomIn(),
    zoomOut: () => canvas.zoomOut(),
    zoomToFit: (options?: ZoomToFitOptions) => canvas.zoomToFit(options),
  }
}

/** Access undo/redo operations and availability signals. */
export function useHistory() {
  const canvas = inject(CanvasService)
  return {
    canRedo: canvas.canRedo,
    canUndo: canvas.canUndo,
    redo: () => canvas.redo(),
    undo: () => canvas.undo(),
  }
}

/**
 * Access resolved style options for every configurable tool and a setter.
 *
 * @returns `{ toolOptions, setToolOptions }` (signals).
 */
export function useToolOptions() {
  const canvas = inject(CanvasService)

  function setToolOptions<T extends ConfigurableToolType>(
    tool: T,
    options: ToolOptionsMap[T],
  ): void {
    canvas.setToolOptions(tool, options)
  }

  return { setToolOptions, toolOptions: canvas.toolOptions }
}

/**
 * Result of {@link useStyle}. `tool` and `style` are signals; they are `null`
 * when no configurable tool is inferred and no tool was passed explicitly.
 */
export interface StyleResult<
  T extends ConfigurableToolType = ConfigurableToolType,
> {
  /** Tool whose style is exposed. */
  tool: Signal<T | null>
  /** Resolved style options for the tool. */
  style: Signal<ResolvedToolOptions<T> | null>
  /** Merge partial style options into the tool. No-op when null. */
  setStyle: (options: ToolOptionsMap[T]) => void
}

/** Result of {@link useStyle} when the tool is inferred. */
export type InferredStyleResult = StyleResult<ConfigurableToolType>

/**
 * Access the style of one drawing tool. Pass a tool explicitly for a fixed
 * style panel, or omit it to follow the current selection / active tool.
 *
 * @param tool Optional configurable tool.
 * @returns `{ tool, style, setStyle }` (signals).
 */
export function useStyle<T extends ConfigurableToolType = ConfigurableToolType>(
  tool?: T,
): StyleResult<T> {
  const canvas = inject(CanvasService)

  const resolvedTool = computed(() => {
    if (tool) {
      return tool
    }
    return inferConfigurableTool(
      canvas.activeTool(),
      canvas.elements(),
      canvas.selectedIds(),
    )
  })

  const style = computed(() => {
    const current = resolvedTool()
    return current ? canvas.toolOptions()[current] : null
  })

  return {
    setStyle: (options: ToolOptionsMap[ConfigurableToolType]) => {
      const current = resolvedTool()
      if (current) {
        canvas.setToolOptions(current, options)
      }
    },
    style: style as Signal<ResolvedToolOptions<T> | null>,
    tool: resolvedTool as Signal<T | null>,
  }
}

/** Access and control transform-overlay visibility. */
export function useTransformOverlay() {
  const canvas = inject(CanvasService)
  return {
    hideWhileTransforming: canvas.hideWhileTransforming,
    setHideWhileTransforming: (hide: boolean) =>
      canvas.setHideWhileTransforming(hide),
  }
}

/** Access selection state and selection operations. */
export function useSelection() {
  const canvas = inject(CanvasService)
  return {
    clearSelection: () => canvas.clearSelection(),
    deleteSelected: () => canvas.deleteSelected(),
    elements: canvas.elements,
    selectAll: () => canvas.selectAll(),
    selectedIds: canvas.selectedIds,
  }
}
