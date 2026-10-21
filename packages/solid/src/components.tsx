import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ElementId,
  resolveAllToolOptions,
  resolveToolOptions,
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
 * Solid-specific canvas options; currently an alias of {@link CanvasOptions}.
 */
export interface CanvasSolidOptions extends CanvasOptions {}

export interface CanvasProviderProps {
  children?: JSX.Element
  options?: CanvasSolidOptions
}

/**
 * Context provider holding the Solid state synced with an adraw canvas.
 */
export function CanvasProvider(props: CanvasProviderProps): JSX.Element {
  const canvasRef: CanvasContextValue["canvasRef"] = { current: null }
  const [elements, setElements] = createSignal<Map<ElementId, CanvasElement>>(
    new Map(),
  )
  const [viewport, setViewport] = createSignal<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
  })
  const [activeTool, setActiveTool] = createSignal<ToolType>("select")
  const [selectedIds, setSelectedIds] = createSignal<Set<ElementId>>(new Set())
  const [canUndo, setCanUndo] = createSignal(false)
  const [canRedo, setCanRedo] = createSignal(false)
  const [hideWhileTransforming, setHideWhileTransforming] = createSignal(
    props.options?.hideOverlayWhileTransforming ?? true,
  )
  const [toolOptions, setToolOptions] = createSignal<ToolOptionsState>(
    resolveAllToolOptions(props.options?.tools),
  )

  const updateToolOptions: SetToolOptions = (tool, options) => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.setToolOptions(tool, options)
      return
    }
    setToolOptions((previous) => ({
      ...previous,
      [tool]: resolveToolOptions(tool, {
        ...previous[tool],
        ...options,
      }),
    }))
  }

  // Keep toolbar state in step when provider options are replaced.
  createEffect(() => {
    const tools = props.options?.tools
    setToolOptions((previous) => ({
      ...previous,
      ...resolveAllToolOptions(tools),
    }))
  })

  const value: CanvasContextValue = {
    activeTool,
    canRedo,
    canUndo,
    canvasRef,
    elements,
    hideWhileTransforming,
    get options() {
      return props.options
    },
    selectedIds,
    setActiveTool,
    setCanRedo,
    setCanUndo,
    setElements,
    setHideWhileTransforming,
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
 * Renders the mount container for the canvas.
 */
export function Canvas(props: CanvasProps): JSX.Element {
  const {
    canvasRef,
    options,
    setElements,
    setViewport,
    setActiveTool,
    setSelectedIds,
    setCanUndo,
    setCanRedo,
    setToolOptions,
  } = useCanvas()
  let containerRef: HTMLDivElement | undefined

  onMount(() => {
    if (!containerRef) {
      return
    }

    const canvas = new AdrawCanvas({
      ...options,
      container: containerRef,
    })

    canvasRef.current = canvas

    // Read history availability after the current pointer/tool handler
    // finishes: tools emit "change" from setElements before calling
    // pushHistory, so canUndo/canRedo are only accurate on the next microtask.
    const syncHistory = () => {
      queueMicrotask(() => {
        setCanUndo(canvas.canUndo())
        setCanRedo(canvas.canRedo())
      })
    }

    canvas.on<"change">(
      "change",
      ({ elements: newElements }: CanvasEventMap["change"]) => {
        setElements(new Map(newElements))
        syncHistory()
      },
    )

    canvas.on<"viewportChange">(
      "viewportChange",
      ({ viewport: newViewport }: CanvasEventMap["viewportChange"]) => {
        setViewport(newViewport)
      },
    )

    canvas.on<"toolChange">(
      "toolChange",
      ({ tool }: CanvasEventMap["toolChange"]) => {
        setActiveTool(tool)
      },
    )

    canvas.on<"selectionChange">(
      "selectionChange",
      ({ selectedIds: newSelectedIds }: CanvasEventMap["selectionChange"]) => {
        setSelectedIds(new Set(newSelectedIds))
      },
    )

    canvas.on<"toolOptionsChange">(
      "toolOptionsChange",
      ({ tool, options: nextOptions }) => {
        setToolOptions(
          (previous) =>
            ({ ...previous, [tool]: nextOptions }) as ToolOptionsState,
        )
      },
    )

    canvas.render()
  })

  onCleanup(() => {
    canvasRef.current?.destroy()
    canvasRef.current = null
  })

  return (
    <div
      ref={containerRef}
      class={props.class}
      style={{ height: "100%", width: "100%", ...props.style }}
    />
  )
}
