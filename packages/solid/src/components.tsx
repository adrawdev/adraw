import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  CONFIGURABLE_TOOLS,
  type ElementId,
  resolveAllToolOptions,
  type ToolOptionsState,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import {
  createComponent,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import {
  CanvasContext,
  useCanvas,
  type CanvasContextValue,
  type SetToolOptions,
} from "./hooks"

/**
 * Solid-specific canvas options. Currently an alias of {@link CanvasOptions};
 * initial content is configured through `initialElements` / `initialDocument`.
 */
export interface CanvasSolidOptions extends CanvasOptions {}

export interface CanvasProviderProps {
  children?: JSX.Element
  options?: CanvasSolidOptions
  /** Called once per engine after `<Canvas>` mounts it. */
  onReady?: (engine: AdrawCanvas) => void
}

/**
 * Read every resolved per-tool style option from an engine.
 */
function readToolOptions(engine: AdrawCanvas): ToolOptionsState {
  return Object.fromEntries(
    CONFIGURABLE_TOOLS.map((tool) => [tool, engine.getToolOptions(tool)]),
  ) as ToolOptionsState
}

/**
 * Context provider holding the Solid state synced with an adraw canvas.
 *
 * The provider creates the headless engine synchronously; `<Canvas>` only
 * mounts its DOM adapter.
 */
export function CanvasProvider(props: CanvasProviderProps): JSX.Element {
  const engine = new AdrawCanvas(props.options)
  // Core defaults this to false; the Solid adapter documents `true`.
  engine.setHideOverlayWhileTransforming(
    props.options?.hideOverlayWhileTransforming ?? true,
  )
  const canvasRef: CanvasContextValue["canvasRef"] = { current: engine }
  const [elements, setElements] = createSignal<Map<ElementId, CanvasElement>>(
    new Map(engine.getElements()),
  )
  const [viewport, setViewport] = createSignal<ViewportState>(
    engine.getViewport(),
  )
  const [activeTool, setActiveTool] = createSignal<ToolType>(
    engine.getActiveTool(),
  )
  const [selectedIds, setSelectedIds] = createSignal<Set<ElementId>>(
    new Set(engine.getSelectedIds()),
  )
  const [canUndo, setCanUndo] = createSignal(false)
  const [canRedo, setCanRedo] = createSignal(false)
  const [hideWhileTransforming, setHideWhileTransforming] = createSignal(
    engine.getHideOverlayWhileTransforming(),
  )
  const [toolOptions, setToolOptions] = createSignal<ToolOptionsState>(
    readToolOptions(engine),
  )
  const [isReady, setIsReady] = createSignal(false)
  const [isMounted, setIsMounted] = createSignal(false)
  let readyNotified = false

  const syncHistory = () => {
    queueMicrotask(() => {
      setCanUndo(engine.canUndo())
      setCanRedo(engine.canRedo())
    })
  }

  const handleChange = ({
    elements: newElements,
  }: CanvasEventMap["change"]) => {
    setElements(new Map(newElements))
    syncHistory()
  }
  const handleViewportChange = ({
    viewport: newViewport,
  }: CanvasEventMap["viewportChange"]) => {
    setViewport(newViewport)
  }
  const handleToolChange = ({ tool }: CanvasEventMap["toolChange"]) => {
    setActiveTool(tool)
  }
  const handleSelectionChange = ({
    selectedIds: newSelectedIds,
  }: CanvasEventMap["selectionChange"]) => {
    setSelectedIds(new Set(newSelectedIds))
  }
  const handleToolOptionsChange = ({
    tool,
    options: nextOptions,
  }: CanvasEventMap["toolOptionsChange"]) => {
    setToolOptions(
      (previous) => ({ ...previous, [tool]: nextOptions }) as ToolOptionsState,
    )
  }

  engine.on("change", handleChange)
  engine.on("viewportChange", handleViewportChange)
  engine.on("toolChange", handleToolChange)
  engine.on("selectionChange", handleSelectionChange)
  engine.on("toolOptionsChange", handleToolOptionsChange)

  onCleanup(() => {
    engine.off("change", handleChange)
    engine.off("viewportChange", handleViewportChange)
    engine.off("toolChange", handleToolChange)
    engine.off("selectionChange", handleSelectionChange)
    engine.off("toolOptionsChange", handleToolOptionsChange)
    engine.destroy()
  })

  const updateToolOptions: SetToolOptions = (tool, options) => {
    engine.setToolOptions(tool, options)
  }

  // Keep toolbar state in step when provider options are replaced.
  createEffect(() => {
    const tools = props.options?.tools
    setToolOptions((previous) => ({
      ...previous,
      ...resolveAllToolOptions(tools),
    }))
  })

  // Flip readiness once <Canvas> has mounted the engine. Subscriptions above
  // are already active, so onReady sees a fully wired engine.
  createEffect(() => {
    if (!isMounted()) {
      setIsReady(false)
      return
    }

    setIsReady(true)
    if (!readyNotified) {
      readyNotified = true
      props.onReady?.(engine)
    }
  })

  const value: CanvasContextValue = {
    activeTool,
    canRedo,
    canUndo,
    canvasRef,
    elements,
    hideWhileTransforming,
    isReady,
    get options() {
      return props.options
    },
    selectedIds,
    setActiveTool,
    setCanRedo,
    setCanUndo,
    setElements,
    setHideWhileTransforming,
    setIsMounted,
    setSelectedIds,
    setToolOptions,
    setViewport,
    toolOptions,
    updateToolOptions,
    viewport,
  }

  return createComponent(CanvasContext.Provider, {
    get children() {
      return props.children
    },
    value,
  })
}

export interface CanvasProps {
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Renders the mount container for the canvas. The provider owns the engine;
 * this component only mounts and unmounts its DOM adapter.
 */
export function Canvas(props: CanvasProps): JSX.Element {
  const { canvasRef, setIsMounted } = useCanvas()
  let containerRef: HTMLDivElement | undefined

  onMount(() => {
    if (!containerRef) {
      return
    }

    canvasRef.current.mount(containerRef)
    setIsMounted(true)
  })

  onCleanup(() => {
    setIsMounted(false)
    canvasRef.current.destroy()
  })

  return (
    <div
      ref={containerRef}
      class={props.class}
      style={{ height: "100%", width: "100%", ...props.style }}
    />
  )
}
