"use client"

import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ConfigurableToolType,
  type ElementId,
  resolveAllToolOptions,
  type ResolvedToolOptions,
  resolveToolOptions,
  type ToolOptionsState,
  type ToolType,
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
 * React-specific canvas options; currently an alias of {@link CanvasOptions}.
 */
export interface CanvasReactOptions extends CanvasOptions {}

interface CanvasProviderProps {
  children: ReactNode
  options?: CanvasReactOptions
}

/**
 * Context provider holding the React state synced with an adraw canvas.
 *
 * @example
 * ```tsx
 * <CanvasProvider options={...}>
 *   <Canvas />
 * </CanvasProvider>
 * ```
 */
export function CanvasProvider({
  children,
  options: defaultOptions,
}: CanvasProviderProps) {
  const [options, setOptions] = useState<CanvasReactOptions | undefined>(
    defaultOptions,
  )
  const vanillaRef = useRef<AdrawCanvas | null>(null)
  const [elements, setElements] = useState<Map<ElementId, CanvasElement>>(
    new Map(),
  )
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
  })
  const [activeTool, setActiveTool] = useState<ToolType>("select")
  const [selectedIds, setSelectedIds] = useState<Set<ElementId>>(new Set())
  const [hideWhileTransforming, setHideWhileTransforming] = useState<boolean>(
    defaultOptions?.hideOverlayWhileTransforming ?? true,
  )
  const [toolOptions, setToolOptions] = useState<ToolOptionsState>(() =>
    resolveAllToolOptions(defaultOptions?.tools),
  )

  const updateToolOptions = useCallback<SetToolOptions>((tool, nextOptions) => {
    const canvas = vanillaRef.current
    canvas?.setToolOptions(tool, nextOptions)
    setToolOptions((previous) => ({
      ...previous,
      [tool]: canvas
        ? canvas.getToolOptions(tool)
        : resolveToolOptions(tool, {
            ...previous[tool],
            ...nextOptions,
          }),
    }))
  }, [])

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

  // Keep toolbar state in step when the provider options are replaced through
  // `setOptions` (the canvas is re-created with the new defaults).
  useEffect(() => {
    setToolOptions((previous) => ({
      ...previous,
      ...resolveAllToolOptions(options?.tools),
    }))
  }, [options?.tools])

  const value = useMemo<CanvasContextValue>(
    () => ({
      activeTool,
      elements,
      hideWhileTransforming,
      options,
      selectedIds,
      setActiveTool,
      setElements,
      setHideWhileTransforming,
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
      elements,
      viewport,
      activeTool,
      selectedIds,
      hideWhileTransforming,
      options,
      updateToolOptions,
      syncToolOptions,
      toolOptions,
    ],
  )

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  )
}

interface CanvasProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Renders the mount container for the canvas. Must be used inside a
 * {@link CanvasProvider}.
 *
 * @param props.className Optional CSS class.
 * @param props.style Optional inline styles.
 */
export function Canvas({ className, style }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    vanillaRef,
    options,
    setElements,
    setViewport,
    setActiveTool,
    setSelectedIds,
    syncToolOptions,
  } = useCanvas()

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const vanilla = new AdrawCanvas({
      ...options,
      container: containerRef.current,
    })

    vanillaRef.current = vanilla

    const core = vanilla

    core.on<"change">(
      "change",
      ({ elements: newElements }: CanvasEventMap["change"]) => {
        setElements(new Map(newElements))
      },
    )

    core.on<"viewportChange">(
      "viewportChange",
      ({ viewport: newViewport }: CanvasEventMap["viewportChange"]) => {
        setViewport(newViewport)
      },
    )

    core.on<"toolChange">(
      "toolChange",
      ({ tool }: CanvasEventMap["toolChange"]) => {
        setActiveTool(tool)
      },
    )

    core.on<"selectionChange">(
      "selectionChange",
      ({ selectedIds: newSelectedIds }: CanvasEventMap["selectionChange"]) => {
        setSelectedIds(new Set(newSelectedIds))
      },
    )

    core.on<"toolOptionsChange">(
      "toolOptionsChange",
      ({ tool, options: nextOptions }) => {
        syncToolOptions(tool, nextOptions)
      },
    )

    vanilla.render()

    return () => {
      vanilla.destroy()
      vanillaRef.current = null
    }
  }, [
    options,
    setActiveTool,
    setElements,
    setSelectedIds,
    setViewport,
    syncToolOptions,
    vanillaRef,
  ])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: "100%", width: "100%", ...style }}
    />
  )
}
