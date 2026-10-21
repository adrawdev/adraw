// @vitest-environment happy-dom

import { AdrawCanvas, type CanvasElement } from "@adraw/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createApp, defineComponent, h, nextTick } from "vue"

import { Canvas, CanvasProvider, useCanvas, useCanvasEngine } from "../index"

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
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function makeRect(id: string): CanvasElement {
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

describe("Vue canvas lifecycle", () => {
  it("exposes the engine before mount and flips isReady", async () => {
    const onReady = vi.fn()
    let engine: AdrawCanvas | null = null
    let isReady: (() => boolean) | null = null
    let elementsAtSetup: Map<string, CanvasElement> | null = null
    let readyAtSetup: boolean | null = null

    const Probe = defineComponent({
      setup() {
        const context = useCanvas()
        const api = useCanvasEngine()
        engine = api.engine
        isReady = () => api.isReady
        elementsAtSetup = context.state.elements
        readyAtSetup = api.isReady
        return () => h("span")
      },
    })

    const App = defineComponent({
      render: () =>
        h(
          CanvasProvider,
          {
            onReady,
            options: { initialElements: [makeRect("keep")] },
          },
          { default: () => [h(Probe), h(Canvas)] },
        ),
    })

    const root = document.createElement("div")
    document.body.appendChild(root)
    const app = createApp(App)
    app.mount(root)
    await nextTick()

    expect(engine).toBeInstanceOf(AdrawCanvas)
    expect(elementsAtSetup).not.toBeNull()
    expect(elementsAtSetup!.size).toBe(1)
    expect(readyAtSetup).toBe(false)
    expect(isReady!()).toBe(true)
    expect(onReady).toHaveBeenCalledOnce()
    expect(onReady.mock.calls[0][0]).toBe(engine)

    app.unmount()
  })
})
