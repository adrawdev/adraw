import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ElementId,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import {
  createComponent,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import { CanvasContext, useCanvas, type CanvasContextValue } from "./hooks"

export interface CanvasSolidOptions extends CanvasOptions {}

export interface CanvasProviderProps {
  children?: JSX.Element
  options?: CanvasSolidOptions
}

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
    setViewport,
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
  } = useCanvas()
  let containerRef: HTMLDivElement | undefined

  onMount(() => {
    if (!containerRef) {
      return
    }

    const canvas = new AdrawCanvas({
      container: containerRef,
      hideOverlayWhileTransforming: options?.hideOverlayWhileTransforming,
      initialViewport: options?.initialViewport,
      snapping: options?.snapping,
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
