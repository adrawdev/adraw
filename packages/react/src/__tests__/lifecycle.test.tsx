// @vitest-environment happy-dom

import { AdrawCanvas, type CanvasElement, type ElementId } from "@adraw/core"
import { act, StrictMode, useEffect, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Canvas, CanvasProvider, useCanvas, useCanvasEngine } from "../index"

type Context = ReturnType<typeof useCanvas>

const reactGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactGlobal.IS_REACT_ACT_ENVIRONMENT = true

const roots: { container: HTMLDivElement; root: Root }[] = []

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect(): void {}
      observe(): void {}
      unobserve(): void {}
    },
  )
})

afterEach(() => {
  for (const { container, root } of roots.splice(0)) {
    act(() => {
      root.unmount()
    })
    container.remove()
  }
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function render(ui: ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push({ container, root })

  await act(async () => {
    root.render(ui)
  })

  return container
}

function makeRect(id: ElementId): CanvasElement {
  return {
    cornerRadius: 0,
    height: 20,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    type: "rectangle",
    visible: true,
    width: 20,
    x: 0,
    y: 0,
    zIndex: 0,
  }
}

function useContextProbe(store: { current: Context | null }) {
  store.current = useCanvas()
}

describe("React canvas lifecycle", () => {
  it("exposes the engine before child effects and flips isReady", async () => {
    const seen: AdrawCanvas[] = []
    const readyStates: boolean[] = []
    let engineFromRender: AdrawCanvas | null = null

    function Probe() {
      const { engine, isReady } = useCanvasEngine()
      engineFromRender = engine
      readyStates.push(isReady)

      useEffect(() => {
        seen.push(engine)
      }, [engine])

      return <output data-ready={String(isReady)} />
    }

    const container = await render(
      <CanvasProvider>
        <Probe />
        <Canvas />
      </CanvasProvider>,
    )

    expect(engineFromRender).toBeInstanceOf(AdrawCanvas)
    expect(seen).toEqual([engineFromRender])
    expect(readyStates[0]).toBe(false)
    expect(readyStates.at(-1)).toBe(true)
    expect(container.querySelector("output")?.getAttribute("data-ready")).toBe(
      "true",
    )
  })

  it("seeds React state from initialElements before effects", async () => {
    const store: { current: Context | null } = { current: null }
    let firstRenderElements: Map<ElementId, CanvasElement> | null = null

    function Probe() {
      useContextProbe(store)
      firstRenderElements ??= store.current!.elements
      return null
    }

    await render(
      <CanvasProvider
        options={{ initialElements: [makeRect("a"), makeRect("b")] }}
      >
        <Probe />
      </CanvasProvider>,
    )

    expect(firstRenderElements).not.toBeNull()
    expect([...firstRenderElements!.keys()]).toEqual(["a", "b"])
    expect(store.current!.engine.getElements().size).toBe(2)
  })

  it("gives initialDocument precedence over initialElements", async () => {
    const store: { current: Context | null } = { current: null }

    function Probe() {
      useContextProbe(store)
      return null
    }

    await render(
      <CanvasProvider
        options={{
          initialDocument: { elements: [makeRect("document")], version: 1 },
          initialElements: [makeRect("elements")],
        }}
      >
        <Probe />
      </CanvasProvider>,
    )

    expect([...store.current!.elements.keys()]).toEqual(["document"])
  })

  it("applies live options without recreating the engine or losing elements", async () => {
    const store: { current: Context | null } = { current: null }

    function Probe() {
      useContextProbe(store)
      return null
    }

    await render(
      <CanvasProvider options={{ initialElements: [makeRect("keep")] }}>
        <Probe />
        <Canvas />
      </CanvasProvider>,
    )

    const engine = store.current!.engine

    await act(async () => {
      store.current!.setOptions({ hideOverlayWhileTransforming: false })
    })

    expect(store.current!.engine).toBe(engine)
    expect(store.current!.engine.getElements().has("keep")).toBe(true)
    expect(store.current!.engine.getHideOverlayWhileTransforming()).toBe(false)
  })

  it("does not recreate the engine when options change identity only", async () => {
    const store: { current: Context | null } = { current: null }

    function Probe() {
      useContextProbe(store)
      return null
    }

    await render(
      <CanvasProvider options={{ initialElements: [makeRect("keep")] }}>
        <Probe />
        <Canvas />
      </CanvasProvider>,
    )

    const engine = store.current!.engine

    await act(async () => {
      store.current!.setOptions((previous) => ({ ...previous }))
    })

    expect(store.current!.engine).toBe(engine)
    expect(store.current!.engine.getElements().has("keep")).toBe(true)
  })

  it("recreates only for constructor-only options and preserves the document", async () => {
    const onReady = vi.fn()
    const store: { current: Context | null } = { current: null }

    function Probe() {
      useContextProbe(store)
      return null
    }

    await render(
      <CanvasProvider
        onReady={onReady}
        options={{
          initialElements: [makeRect("keep")],
          initialViewport: { x: 10, y: 20, zoom: 2 },
          keyboard: "canvas",
        }}
      >
        <Probe />
        <Canvas />
      </CanvasProvider>,
    )

    const before = store.current!.engine

    await act(async () => {
      before.setViewport({ x: 5, y: 6, zoom: 1.5 })
      store.current!.setOptions((previous) => ({
        ...previous,
        keyboard: "document",
      }))
    })

    const after = store.current!.engine
    expect(after).not.toBe(before)
    expect(after.getElements().has("keep")).toBe(true)
    expect(after.getViewport()).toEqual({ x: 5, y: 6, zoom: 1.5 })
    expect(onReady).toHaveBeenCalledTimes(2)
    expect(onReady.mock.calls[1][0]).toBe(after)
  })

  it("does not duplicate onReady or initial content in StrictMode", async () => {
    const onReady = vi.fn()
    const store: { current: Context | null } = { current: null }

    function Probe() {
      useContextProbe(store)
      return null
    }

    await render(
      <StrictMode>
        <CanvasProvider
          onReady={onReady}
          options={{ initialElements: [makeRect("keep")] }}
        >
          <Probe />
          <Canvas />
        </CanvasProvider>
      </StrictMode>,
    )

    expect(onReady).toHaveBeenCalledTimes(1)
    expect(store.current!.engine.getElements().has("keep")).toBe(true)
    expect(store.current!.isReady).toBe(true)
  })
})
