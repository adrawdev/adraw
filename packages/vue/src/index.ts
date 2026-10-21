import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasOptions,
  type ConfigurableToolType,
  type ElementId,
  inferConfigurableTool,
  resolveAllToolOptions,
  type ResolvedToolOptions,
  type ToolOptionsMap,
  type ToolOptionsState,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import {
  h,
  inject,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  type InjectionKey,
  type VNode,
} from "vue"

/**
 * Vue-specific canvas options.
 */
export interface CanvasVueOptions extends CanvasOptions {
  initialViewport?: ViewportState
}

/**
 * Reactive state synced with an adraw canvas.
 */
export interface CanvasState {
  elements: Map<ElementId, CanvasElement>
  viewport: ViewportState
  activeTool: ToolType
  selectedIds: Set<ElementId>
  hideWhileTransforming: boolean
  toolOptions: ToolOptionsState
  // Bumped on every "change" event (draw, erase, undo, redo, delete). Read by
  // useHistory() so canUndo/canRedo register a reactive dependency even
  // though AdrawCanvas's own history stack isn't itself reactive.
  historyVersion: number
}

/**
 * Create a Vue canvas instance and reactive state.
 * @param options Canvas options.
 */
export function createCanvas(options?: CanvasVueOptions) {
  const core = new AdrawCanvas(options)
  const vanilla = ref<AdrawCanvas | null>(null)

  const state = reactive<CanvasState>({
    activeTool: core.getActiveTool(),
    elements: core.getElements(),
    hideWhileTransforming: core.getHideOverlayWhileTransforming(),
    historyVersion: 0,
    selectedIds: core.getSelectedIds(),
    toolOptions: resolveAllToolOptions(options?.tools),
    viewport: core.getViewport(),
  })

  core.on("change", ({ elements: newElements }) => {
    state.elements = new Map(newElements)
    state.historyVersion++
  })

  core.on("viewportChange", ({ viewport: newViewport }) => {
    state.viewport = newViewport
  })

  core.on("toolChange", ({ tool }) => {
    state.activeTool = tool
  })

  core.on("selectionChange", ({ selectedIds: newSelectedIds }) => {
    state.selectedIds = new Set(newSelectedIds)
  })

  core.on("toolOptionsChange", ({ tool, options: nextOptions }) => {
    state.toolOptions = {
      ...state.toolOptions,
      [tool]: nextOptions,
    } as ToolOptionsState
  })

  return {
    core,
    state,
    vanilla,
  }
}

/** Context returned by {@link createCanvas}. */
export type CanvasContext = ReturnType<typeof createCanvas>

// Each <CanvasProvider> provides its own context down its own subtree, so
// composables resolve to whichever provider is nearest — this is what lets
// multiple independent <CanvasProvider>/<Canvas> pairs coexist on one page.
const canvasInjectionKey: InjectionKey<CanvasContext> = Symbol("adraw-canvas")

/**
 * Component providing a canvas context to its subtree.
 */
export const CanvasProvider = {
  props: {
    options: Object,
  },
  setup(
    props: { options?: CanvasVueOptions },
    { slots }: { slots: { default?: () => VNode[] } },
  ): () => VNode[] | undefined {
    const canvas = createCanvas(props.options)
    provide(canvasInjectionKey, canvas)

    onUnmounted(() => {
      canvas.vanilla.value?.destroy()
    })

    return () => slots.default?.()
  },
}

// Resolves the nearest <CanvasProvider>. Must be called synchronously during
// a component's setup() (directly, or from a composable invoked there) —
// Vue's inject() only sees the active component instance at that point.
/**
 * Resolve the nearest canvas context.
 * @throws When used outside a `CanvasProvider`.
 */
export function useCanvas(): CanvasContext {
  const context = inject(canvasInjectionKey, null)
  if (!context) {
    throw new Error("useCanvas must be used within a CanvasProvider")
  }
  return context
}

/** Access the active tool and a setter. */
export function useTool() {
  const canvas = useCanvas()

  return {
    setTool: (tool: ToolType) => {
      canvas.core.setActiveTool(tool)
    },
    get tool() {
      return canvas.state.activeTool
    },
  }
}

/** Access viewport state and zoom/pan helpers. */
export function useViewport() {
  const canvas = useCanvas()

  return {
    resetZoom: () => canvas.core.resetZoom(),
    setViewport: (viewport: ViewportState) => {
      canvas.core.setViewport(viewport)
    },
    get viewport() {
      return canvas.state.viewport
    },
    zoomIn: () => canvas.core.zoomIn(),
    zoomOut: () => canvas.core.zoomOut(),
    zoomToFit: () => canvas.core.zoomToFit(),
  }
}

/** Access undo/redo operations and availability. */
export function useHistory() {
  const canvas = useCanvas()

  return {
    canRedo: () => {
      void canvas.state.historyVersion
      return canvas.core.canRedo()
    },
    canUndo: () => {
      void canvas.state.historyVersion
      return canvas.core.canUndo()
    },
    redo: () => canvas.core.redo(),
    undo: () => canvas.core.undo(),
  }
}

/** Merge partial style options into a tool's current options. */
export type SetToolOptions = <T extends ConfigurableToolType>(
  tool: T,
  options: ToolOptionsMap[T],
) => void

/**
 * Access resolved style options for every configurable tool and a setter.
 *
 * @returns `{ toolOptions, setToolOptions }` with reactive getters.
 */
export function useToolOptions() {
  const canvas = useCanvas()

  function setToolOptions<T extends ConfigurableToolType>(
    tool: T,
    options: ToolOptionsMap[T],
  ): void {
    canvas.core.setToolOptions(tool, options)
  }

  return {
    setToolOptions,
    get toolOptions() {
      return canvas.state.toolOptions
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
  const canvas = useCanvas()

  const resolvedTool = () =>
    tool ??
    inferConfigurableTool(
      canvas.state.activeTool,
      canvas.state.elements,
      canvas.state.selectedIds,
    )

  return {
    setStyle: (options: ToolOptionsMap[ConfigurableToolType]) => {
      const current = resolvedTool()
      if (current) {
        canvas.core.setToolOptions(current, options)
      }
    },
    get style() {
      const current = resolvedTool()
      return current ? canvas.state.toolOptions[current] : null
    },
    get tool() {
      return resolvedTool()
    },
  }
}

/** Access and control the transform-overlay visibility. */
export function useTransformOverlay() {
  const canvas = useCanvas()

  return {
    get hideWhileTransforming() {
      return canvas.state.hideWhileTransforming
    },
    setHideWhileTransforming: (hide: boolean) => {
      canvas.core.setHideOverlayWhileTransforming(hide)
      canvas.state.hideWhileTransforming = hide
    },
  }
}

/** Access selection state and selection operations. */
export function useSelection() {
  const canvas = useCanvas()

  return {
    clearSelection: () => canvas.core.clearSelection(),
    deleteSelected: () => canvas.core.deleteSelected(),
    get elements() {
      return canvas.state.elements
    },
    selectAll: () => canvas.core.selectAll(),
    get selectedIds() {
      return canvas.state.selectedIds
    },
  }
}

/**
 * Component rendering the mount container.
 */
export const Canvas = {
  props: {
    class: String,
    style: Object,
  },
  setup(props: { class?: string; style?: Record<string, any> }): () => VNode {
    const containerRef = ref<HTMLDivElement | null>(null)
    const canvas = useCanvas()

    onMounted(() => {
      if (!containerRef.value) {
        return
      }

      canvas.core.mount(containerRef.value)
      canvas.vanilla.value = canvas.core
    })

    return () =>
      h("div", {
        class: props.class,
        ref: containerRef,
        style: { height: "100%", width: "100%", ...props.style },
      })
  },
}
