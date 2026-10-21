"use client"

import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ConfigurableToolType,
  CONFIGURABLE_TOOLS,
  createSnappingConfig,
  type ElementId,
  type ResolvedToolOptions,
  resolveToolOptions,
  resolveViewportConfig,
  type ToolOptionsMap,
  type ToolOptionsState,
  type ToolType,
  type ViewportConfig,
  type ViewportState,
} from "@adraw/core"
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  CanvasContext,
  useCanvas,
  type CanvasContextValue,
  type SetToolOptions,
} from "./hooks"

/**
 * React-specific canvas options. Currently an alias of {@link CanvasOptions};
 * initial content (`initialElements` / `initialDocument`) is configured
 * through the same object and applied when the provider creates the engine.
 */
export interface CanvasReactOptions extends CanvasOptions {}

/**
 * Props accepted by {@link CanvasProvider}.
 */
export interface CanvasProviderProps {
  /** Provider subtree. */
  children: ReactNode
  /**
   * Initial canvas configuration. Only the first value is used; call
   * `setOptions` to change options after mount.
   */
  options?: CanvasReactOptions
  /**
   * Called once per engine instance, after `<Canvas>` has mounted it and the
   * provider has subscribed to its events. In React StrictMode the effect
   * cycle runs twice, but the callback is only invoked for the live engine.
   */
  onReady?: (engine: AdrawCanvas) => void
}

type AnyToolOptions = ToolOptionsMap[ConfigurableToolType]

/**
 * Drop initial document data before rebuilding the engine from live state.
 */
function withoutInitialData(
  options: CanvasReactOptions | undefined,
): CanvasOptions {
  const rest: CanvasOptions = { ...options }
  delete rest.initialDocument
  delete rest.initialElements
  return rest
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
 * Create a headless engine, optionally carrying over the document, viewport,
 * selection-independent state and resolved tool styles from a previous one.
 */
function createEngine(
  options: CanvasReactOptions | undefined,
  previous?: AdrawCanvas,
  previousOptions?: CanvasReactOptions,
): AdrawCanvas {
  // Initial content is handled by the core constructor on first creation. On
  // rebuilds the live document wins, so strip the initial fields.
  const engine = new AdrawCanvas(
    previous ? withoutInitialData(options) : options,
  )

  if (previous) {
    engine.loadDocument(previous.toDocument(), { history: false })
    engine.setViewport(previous.getViewport())

    for (const tool of CONFIGURABLE_TOOLS) {
      const defaults = resolveToolOptions(tool) as Record<string, unknown>
      const previousOverrides = previousOptions?.tools?.[tool] as
        | Record<string, unknown>
        | undefined
      const nextOverrides = options?.tools?.[tool] as
        | Record<string, unknown>
        | undefined
      const merged: Record<string, unknown> = {
        ...(previous.getToolOptions(tool) as Record<string, unknown>),
        ...nextOverrides,
      }
      for (const key of Object.keys(previousOverrides ?? {})) {
        if (!nextOverrides || !(key in nextOverrides)) {
          merged[key] = defaults[key]
        }
      }
      engine.setToolOptions(tool, merged as AnyToolOptions)
    }

    engine.setActiveTool(previous.getActiveTool())
  }

  // Core defaults this to false; the React adapter documents `true`.
  engine.setHideOverlayWhileTransforming(
    options?.hideOverlayWhileTransforming ?? true,
  )

  return engine
}

/**
 * Compare resolved viewport configurations so equivalent inline objects do not
 * force an engine rebuild.
 */
function sameViewportConfig(
  left: Partial<ViewportConfig> | undefined,
  right: Partial<ViewportConfig> | undefined,
): boolean {
  const a = resolveViewportConfig(left)
  const b = resolveViewportConfig(right)
  return (
    a.constrainToContent === b.constrainToContent &&
    a.fitPadding === b.fitPadding &&
    a.maxZoom === b.maxZoom &&
    a.minZoom === b.minZoom &&
    a.zoomSensitivity === b.zoomSensitivity
  )
}

/**
 * Compare tool overrides by value so a new inline object with the same styles
 * does not restyle the current selection.
 */
function sameToolOptions(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  const a = left ?? {}
  const b = right ?? {}
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  )
}

/**
 * Whether two option snapshots require a fresh engine. These are the options
 * the core only accepts at construction time; everything else can be applied
 * to the live engine.
 */
function sameCreationOptions(
  left: CanvasReactOptions | undefined,
  right: CanvasReactOptions | undefined,
): boolean {
  return (
    left?.measureText === right?.measureText &&
    (left?.isSnapMode ?? false) === (right?.isSnapMode ?? false) &&
    (left?.keyboard ?? "canvas") === (right?.keyboard ?? "canvas") &&
    createSnappingConfig(left?.snapping).threshold ===
      createSnappingConfig(right?.snapping).threshold &&
    sameViewportConfig(left?.viewport, right?.viewport) &&
    left?.clipboard?.serialize === right?.clipboard?.serialize &&
    left?.clipboard?.deserialize === right?.clipboard?.deserialize
  )
}

/**
 * Apply options that the core can change without recreating the engine.
 */
function applyLiveOptions(
  engine: AdrawCanvas,
  options: CanvasReactOptions | undefined,
  previous: CanvasReactOptions | undefined,
): void {
  const hide = options?.hideOverlayWhileTransforming ?? true
  const previousHide = previous?.hideOverlayWhileTransforming ?? true
  if (hide !== previousHide) {
    engine.setHideOverlayWhileTransforming(hide)
  }

  for (const tool of CONFIGURABLE_TOOLS) {
    const next = options?.tools?.[tool] as Record<string, unknown> | undefined
    const current = previous?.tools?.[tool] as
      | Record<string, unknown>
      | undefined
    if (sameToolOptions(next, current)) {
      continue
    }

    // Start from the engine's resolved values so runtime customizations made
    // through `useStyle`/`setToolOptions` survive. Keys that were overridden
    // by the previous options but are absent from the next ones fall back to
    // their defaults (a plain merge would keep the stale override).
    const defaults = resolveToolOptions(tool) as Record<string, unknown>
    const merged: Record<string, unknown> = {
      ...(engine.getToolOptions(tool) as Record<string, unknown>),
      ...next,
    }
    for (const key of Object.keys(current ?? {})) {
      if (!next || !(key in next)) {
        merged[key] = defaults[key]
      }
    }
    engine.setToolOptions(tool, merged as AnyToolOptions)
  }
}

/**
 * Context provider holding the React state synced with an adraw canvas.
 *
 * The provider creates a headless {@link AdrawCanvas} synchronously, so the
 * engine is available to descendants before any effect runs. `<Canvas>` only
 * mounts it into the DOM.
 *
 * @example
 * ```tsx
 * <CanvasProvider
 *   options={{ initialElements }}
 *   onReady={(engine) => engine.setActiveTool("draw")}
 * >
 *   <Canvas />
 * </CanvasProvider>
 * ```
 */
export function CanvasProvider({
  children,
  options: defaultOptions,
  onReady,
}: CanvasProviderProps) {
  const [options, setOptions] = useState<CanvasReactOptions | undefined>(
    defaultOptions,
  )
  const [engine, setEngine] = useState<AdrawCanvas>(() =>
    createEngine(defaultOptions),
  )
  const [elements, setElements] = useState<Map<ElementId, CanvasElement>>(
    () => new Map(engine.getElements()),
  )
  const [viewport, setViewport] = useState<ViewportState>(() =>
    engine.getViewport(),
  )
  const [activeTool, setActiveTool] = useState<ToolType>(() =>
    engine.getActiveTool(),
  )
  const [selectedIds, setSelectedIds] = useState<Set<ElementId>>(
    () => new Set(engine.getSelectedIds()),
  )
  const [hideWhileTransforming, setHideWhileTransforming] = useState<boolean>(
    () => engine.getHideOverlayWhileTransforming(),
  )
  const [toolOptions, setToolOptions] = useState<ToolOptionsState>(() =>
    readToolOptions(engine),
  )
  const [isMounted, setIsMounted] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const vanillaRef = useRef<AdrawCanvas | null>(null)
  vanillaRef.current = engine

  const optionsRef = useRef(options)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  // Engine whose state is already mirrored into React state. Used to resync
  // after `setOptions` replaces the engine without resetting on every effect
  // setup (including StrictMode's double invocation).
  const syncedEngineRef = useRef(engine)
  // Engine for which `onReady` has already fired.
  const readyEngineRef = useRef<AdrawCanvas | null>(null)

  const updateToolOptions = useCallback<SetToolOptions>(
    (tool, nextOptions) => {
      engine.setToolOptions(tool, nextOptions)
      setToolOptions((previous) => ({
        ...previous,
        [tool]: engine.getToolOptions(tool),
      }))
    },
    [engine],
  )

  const syncToolOptions = useCallback(
    (
      tool: ConfigurableToolType,
      nextOptions: ResolvedToolOptions<ConfigurableToolType>,
    ) => {
      setToolOptions(
        (previous) =>
          ({ ...previous, [tool]: nextOptions }) as ToolOptionsState,
      )
    },
    [],
  )

  // Mirror engine state into React. Runs after child effects, so `<Canvas>`
  // has already mounted the engine by the time `onReady` is invoked below.
  useEffect(() => {
    if (syncedEngineRef.current !== engine) {
      syncedEngineRef.current = engine
      setElements(new Map(engine.getElements()))
      setViewport(engine.getViewport())
      setActiveTool(engine.getActiveTool())
      setSelectedIds(new Set(engine.getSelectedIds()))
      setHideWhileTransforming(engine.getHideOverlayWhileTransforming())
      setToolOptions(readToolOptions(engine))
    }

    const handleChange = ({
      elements: newElements,
    }: CanvasEventMap["change"]) => {
      setElements(new Map(newElements))
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
      syncToolOptions(tool, nextOptions)
    }

    engine.on("change", handleChange)
    engine.on("viewportChange", handleViewportChange)
    engine.on("toolChange", handleToolChange)
    engine.on("selectionChange", handleSelectionChange)
    engine.on("toolOptionsChange", handleToolOptionsChange)

    return () => {
      engine.off("change", handleChange)
      engine.off("viewportChange", handleViewportChange)
      engine.off("toolChange", handleToolChange)
      engine.off("selectionChange", handleSelectionChange)
      engine.off("toolOptionsChange", handleToolOptionsChange)
    }
  }, [engine, syncToolOptions])

  // Flip `isReady` after the engine is mounted and its events are subscribed.
  // The effect is declared after the subscription effect so that ordering
  // holds on every commit.
  useEffect(() => {
    if (!isMounted) {
      return
    }

    setIsReady(true)
    if (readyEngineRef.current !== engine) {
      readyEngineRef.current = engine
      onReadyRef.current?.(engine)
    }

    return () => {
      setIsReady(false)
    }
  }, [engine, isMounted])

  // Apply `setOptions` changes. Constructor-only options rebuild the engine
  // while preserving the document and viewport; everything else is applied to
  // the live engine. Identity changes with equal values are a no-op.
  useEffect(() => {
    const previous = optionsRef.current
    if (previous === options) {
      return
    }
    optionsRef.current = options

    if (!sameCreationOptions(previous, options)) {
      const nextEngine = createEngine(options, engine, previous)
      setIsReady(false)
      setEngine(nextEngine)
      return
    }

    applyLiveOptions(engine, options, previous)
  }, [engine, options])

  const value = useMemo<CanvasContextValue>(
    () => ({
      activeTool,
      elements,
      engine,
      hideWhileTransforming,
      isReady,
      options,
      selectedIds,
      setActiveTool,
      setElements,
      setHideWhileTransforming,
      setIsMounted,
      setOptions,
      setSelectedIds,
      setToolOptions: updateToolOptions,
      setViewport,
      syncToolOptions,
      toolOptions,
      vanillaRef,
      viewport,
    }),
    [
      activeTool,
      elements,
      engine,
      hideWhileTransforming,
      isReady,
      options,
      selectedIds,
      setIsMounted,
      updateToolOptions,
      syncToolOptions,
      toolOptions,
      viewport,
    ],
  )

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  )
}

/**
 * Props accepted by {@link Canvas}.
 */
export interface CanvasProps {
  /** Optional CSS class. */
  className?: string
  /** Optional inline styles. */
  style?: React.CSSProperties
}

/**
 * Renders the mount container for the canvas. Must be used inside a
 * {@link CanvasProvider}. The provider owns the engine; this component only
 * mounts and unmounts its DOM adapter.
 *
 * @param props.className Optional CSS class.
 * @param props.style Optional inline styles.
 */
export function Canvas({ className, style }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { engine, setIsMounted } = useCanvas()

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    engine.mount(container)
    setIsMounted(true)

    return () => {
      setIsMounted(false)
      engine.destroy()
    }
  }, [engine, setIsMounted])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: "100%", width: "100%", ...style }}
    />
  )
}
