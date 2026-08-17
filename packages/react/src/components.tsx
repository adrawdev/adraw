"use client"

import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ElementId,
  type ToolType,
  type ViewportState,
} from "@adraw/core"
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { CanvasContext, useCanvas, type CanvasContextValue } from "./hooks"

export interface CanvasReactOptions extends CanvasOptions {}

interface CanvasProviderProps {
  children: ReactNode
  options?: CanvasReactOptions
}

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
      setViewport,
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

export function Canvas({ className, style }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    vanillaRef,
    options,
    setElements,
    setViewport,
    setActiveTool,
    setSelectedIds,
  } = useCanvas()

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const vanilla = new AdrawCanvas({
      container: containerRef.current,
      hideOverlayWhileTransforming: options?.hideOverlayWhileTransforming,
      initialViewport: options?.initialViewport,
      snapping: options?.snapping,
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

    vanilla.render()

    return () => {
      vanilla.destroy()
      vanillaRef.current = null
    }
  }, [
    options?.hideOverlayWhileTransforming,
    options?.initialViewport,
    options?.snapping,
    setActiveTool,
    setElements,
    setSelectedIds,
    setViewport,
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
