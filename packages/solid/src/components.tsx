import { AdrawCanvas, AdrawStore, type CanvasOptions } from "@adraw/core"
import {
  createComponent,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js"

import { CanvasContext, useCanvas, type CanvasContextValue } from "./hooks"

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
 * Context provider holding the Solid state synced with an adraw canvas.
 *
 * The provider creates the headless engine and store synchronously;
 * `<Canvas>` only mounts its DOM adapter.
 */
export function CanvasProvider(props: CanvasProviderProps): JSX.Element {
  const engine = new AdrawCanvas(props.options)
  // Core defaults this to false; the Solid adapter documents `true`.
  engine.setHideOverlayWhileTransforming(
    props.options?.hideOverlayWhileTransforming ?? true,
  )

  const store = new AdrawStore(engine, { onReady: props.onReady })
  const [snapshot, setSnapshot] = createSignal(store.getSnapshot())
  const unsubscribe = store.subscribe(() => {
    setSnapshot(store.getSnapshot())
  })

  const canvasRef: CanvasContextValue["canvasRef"] = { current: engine }
  const elements = () => snapshot().elements
  const selectedIds = () => snapshot().selectedIds
  const selectedElements = () => snapshot().selectedElements
  const viewport = () => snapshot().viewport
  const activeTool = () => snapshot().tool
  const canUndo = () => snapshot().canUndo
  const canRedo = () => snapshot().canRedo
  const hideWhileTransforming = () => snapshot().hideWhileTransforming
  const style = () => snapshot().style
  const isReady = () => snapshot().isReady

  onCleanup(() => {
    unsubscribe()
    store.dispose()
    engine.destroy()
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
    selectedElements,
    selectedIds,
    snapshot,
    store,
    style,
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
  const { canvasRef } = useCanvas()
  let containerRef: HTMLDivElement | undefined

  onMount(() => {
    if (!containerRef) {
      return
    }

    canvasRef.current.mount(containerRef)
  })

  onCleanup(() => {
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
