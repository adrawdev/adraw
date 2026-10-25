"use client"

import {
  AdrawCanvas,
  AdrawStore,
  type CanvasOptions,
  createSnappingConfig,
  resolveViewportConfig,
  type ViewportConfig,
} from "@adraw/core"
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import { CanvasContext, useCanvas, type CanvasContextValue } from "./hooks"

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
   * Called once per engine instance, after `<Canvas>` has mounted it. In React
   * StrictMode the effect cycle runs twice, but the callback is only invoked
   * for the live engine.
   */
  onReady?: (engine: AdrawCanvas) => void
}

interface CanvasSession {
  engine: AdrawCanvas
  store: AdrawStore
}

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
 * Create a headless engine, optionally carrying over the document and viewport
 * from a previous one.
 */
function createEngine(
  options: CanvasReactOptions | undefined,
  previous?: AdrawCanvas,
): AdrawCanvas {
  // Initial content is handled by the core constructor on first creation. On
  // rebuilds the live document wins, so strip the initial fields.
  const engine = new AdrawCanvas(
    previous ? withoutInitialData(options) : options,
  )

  if (previous) {
    engine.loadDocument(previous.toDocument(), { history: false })
    engine.setViewport(previous.getViewport())
    engine.setActiveTool(previous.getActiveTool())
  }

  // Core defaults this to false; the React adapter documents `true`.
  engine.setHideOverlayWhileTransforming(
    options?.hideOverlayWhileTransforming ?? true,
  )

  return engine
}

/**
 * Create the engine/store pair owned by a provider session.
 */
function createSession(
  options: CanvasReactOptions | undefined,
  onReady: (engine: AdrawCanvas) => void,
  previous?: AdrawCanvas,
): CanvasSession {
  const engine = createEngine(options, previous)
  const store = new AdrawStore(engine, { onReady })
  return { engine, store }
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

  const toolLocked = options?.isToolLocked ?? false
  const previousToolLocked = previous?.isToolLocked ?? false
  if (toolLocked !== previousToolLocked) {
    engine.setIsToolLocked(toolLocked)
  }
}

/**
 * Context provider holding the React state synced with an adraw canvas.
 *
 * The provider creates a headless {@link AdrawCanvas} and its
 * {@link AdrawStore} synchronously, so both are available to descendants
 * before any effect runs. `<Canvas>` only mounts the engine into the DOM.
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
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const [session, setSession] = useState<CanvasSession>(() =>
    createSession(defaultOptions, (engine) => {
      onReadyRef.current?.(engine)
    }),
  )
  const optionsRef = useRef(options)

  const snapshot = useSyncExternalStore(
    session.store.subscribe,
    session.store.getSnapshot,
    session.store.getSnapshot,
  )

  // Dispose the store on a real provider unmount, but not on StrictMode's
  // simulated cleanup/re-setup cycle.
  const mountedRef = useRef(false)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  useEffect(() => {
    const store = session.store
    return () => {
      queueMicrotask(() => {
        if (!mountedRef.current) {
          store.dispose()
        }
      })
    }
  }, [session.store])

  // Apply `setOptions` changes. Constructor-only options rebuild the engine
  // and store while preserving the document and viewport; everything else is
  // applied to the live engine.
  useEffect(() => {
    const previous = optionsRef.current
    if (previous === options) {
      return
    }
    optionsRef.current = options

    if (!sameCreationOptions(previous, options)) {
      const nextSession = createSession(
        options,
        (engine) => {
          onReadyRef.current?.(engine)
        },
        session.engine,
      )
      session.store.dispose()
      setSession(nextSession)
      return
    }

    applyLiveOptions(session.engine, options, previous)
  }, [options, session.engine, session.store])

  const vanillaRef = useRef<AdrawCanvas | null>(session.engine)
  vanillaRef.current = session.engine

  const value = useMemo<CanvasContextValue>(
    () => ({
      activeTool: snapshot.tool,
      elements: snapshot.elements,
      engine: session.engine,
      hideWhileTransforming: snapshot.hideWhileTransforming,
      isReady: snapshot.isReady,
      options,
      selectedIds: snapshot.selectedIds,
      setActiveTool: (tool) => session.engine.setActiveTool(tool),
      setElements: (elements) => session.engine.setElements(elements),
      setHideWhileTransforming: (hide) =>
        session.engine.setHideOverlayWhileTransforming(hide),
      setOptions,
      setSelectedIds: (ids) => session.engine.setSelectedIds(ids),
      setViewport: (viewport) => session.engine.setViewport(viewport),
      snapshot,
      store: session.store,
      style: snapshot.style,
      vanillaRef,
      viewport: snapshot.viewport,
    }),
    [options, session, snapshot],
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
  const { engine } = useCanvas()

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    engine.mount(container)

    return () => {
      engine.destroy()
    }
  }, [engine])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: "100%", width: "100%", ...style }}
    />
  )
}
