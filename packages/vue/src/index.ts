import {
  AdrawCanvas,
  AdrawStore,
  type AdrawSnapshot,
  type CanvasElement,
  type CanvasOptions,
  type ElementId,
  type SnappingConfig,
  type StyleOptions,
  type ToolType,
  type ViewportState,
  type ZoomToFitOptions,
} from "@adraw/core"
import {
  computed,
  h,
  inject,
  onMounted,
  onUnmounted,
  provide,
  reactive,
  ref,
  shallowRef,
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
  elements: ReadonlyMap<ElementId, CanvasElement>
  selectedElements: readonly CanvasElement[]
  viewport: ViewportState
  activeTool: ToolType
  selectedIds: ReadonlySet<ElementId>
  hideWhileTransforming: boolean
  style: StyleOptions
  snapping: SnappingConfig
  isSnapMode: boolean
  isToolLocked: boolean
  canUndo: boolean
  canRedo: boolean
}

function stateFromSnapshot(snapshot: AdrawSnapshot): CanvasState {
  return {
    activeTool: snapshot.tool,
    canRedo: snapshot.canRedo,
    canUndo: snapshot.canUndo,
    elements: snapshot.elements,
    hideWhileTransforming: snapshot.hideWhileTransforming,
    isSnapMode: snapshot.isSnapMode,
    isToolLocked: snapshot.isToolLocked,
    selectedElements: snapshot.selectedElements,
    selectedIds: snapshot.selectedIds,
    snapping: snapshot.snapping,
    style: snapshot.style,
    viewport: snapshot.viewport,
  }
}

/**
 * Create a Vue canvas instance and reactive state.
 * @param options Canvas options, including `initialElements` / `initialDocument`.
 * @param onReady Called once after `<Canvas>` mounts the engine.
 */
export function createCanvas(
  options?: CanvasVueOptions,
  onReady?: (engine: AdrawCanvas) => void,
) {
  const core = new AdrawCanvas(options)
  // Core defaults this to false; the Vue adapter documents `true`.
  core.setHideOverlayWhileTransforming(
    options?.hideOverlayWhileTransforming ?? true,
  )

  const store = new AdrawStore(core, { onReady })
  const snapshot = shallowRef(store.getSnapshot())
  const isReady = computed(() => snapshot.value.isReady)
  const state = reactive<CanvasState>(stateFromSnapshot(snapshot.value))
  const vanilla = ref<AdrawCanvas | null>(null)

  const unsubscribe = store.subscribe(() => {
    const next = store.getSnapshot()
    snapshot.value = next
    Object.assign(state, stateFromSnapshot(next))
  })

  return {
    core,
    dispose: () => {
      unsubscribe()
      store.dispose()
    },
    isReady,
    snapshot,
    state,
    store,
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
    onReady: Function,
    options: Object,
  },
  setup(
    props: {
      onReady?: (engine: AdrawCanvas) => void
      options?: CanvasVueOptions
    },
    { slots }: { slots: { default?: () => VNode[] } },
  ): () => VNode[] | undefined {
    const canvas = createCanvas(props.options, (engine) =>
      props.onReady?.(engine),
    )
    provide(canvasInjectionKey, canvas)

    onUnmounted(() => {
      canvas.vanilla.value?.destroy()
      canvas.dispose()
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

/**
 * State returned by {@link useCanvasEngine}.
 */
export interface CanvasEngineState {
  /** Engine owned by the nearest `CanvasProvider`. */
  engine: AdrawCanvas
  /** `true` after `<Canvas>` has mounted the engine. */
  readonly isReady: boolean
}

/**
 * Access the engine and a reactive readiness flag.
 *
 * The engine exists as soon as the provider is created, so composables and
 * effects do not need to wait for a template ref. `isReady` becomes `true`
 * after `<Canvas>` mounts it and flips back on unmount.
 *
 * @returns `{ engine, isReady }` where `isReady` is a reactive getter.
 */
export function useCanvasEngine(): CanvasEngineState {
  const canvas = useCanvas()
  return {
    engine: canvas.core,
    get isReady() {
      return canvas.snapshot.value.isReady
    },
  }
}

/** Access the active tool and a setter. */
export function useTool() {
  const canvas = useCanvas()

  return {
    setTool: (tool: ToolType) => {
      canvas.core.setActiveTool(tool)
    },
    get tool() {
      return canvas.snapshot.value.tool
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
      return canvas.snapshot.value.viewport
    },
    zoomIn: () => canvas.core.zoomIn(),
    zoomOut: () => canvas.core.zoomOut(),
    zoomToFit: (options?: ZoomToFitOptions) => canvas.core.zoomToFit(options),
  }
}

/** Access undo/redo operations and availability. */
export function useHistory() {
  const canvas = useCanvas()

  return {
    canRedo: () => canvas.snapshot.value.canRedo,
    canUndo: () => canvas.snapshot.value.canUndo,
    redo: () => canvas.core.redo(),
    undo: () => canvas.core.undo(),
  }
}

/** Access and control the transform-overlay visibility. */
export function useTransformOverlay() {
  const canvas = useCanvas()

  return {
    get hideWhileTransforming() {
      return canvas.snapshot.value.hideWhileTransforming
    },
    setHideWhileTransforming: (hide: boolean) => {
      canvas.core.setHideOverlayWhileTransforming(hide)
    },
  }
}

/** Access the current style and update the global/selected style. */
export function useStyle() {
  const canvas = useCanvas()

  return {
    setStyle: (options: StyleOptions) => {
      canvas.core.setStyle(options)
    },
    get style() {
      return canvas.snapshot.value.style
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
      return canvas.snapshot.value.selectedElements
    },
    selectAll: () => canvas.core.selectAll(),
    get selectedIds() {
      return canvas.snapshot.value.selectedIds
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

    onUnmounted(() => {
      canvas.vanilla.value?.destroy()
      canvas.vanilla.value = null
    })

    return () =>
      h("div", {
        class: props.class,
        ref: containerRef,
        style: { height: "100%", width: "100%", ...props.style },
      })
  },
}
