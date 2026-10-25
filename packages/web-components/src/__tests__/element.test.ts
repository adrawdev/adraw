// @vitest-environment happy-dom

import { AdrawCanvas, type CanvasElement } from "@adraw/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { type AdrawCanvasElement, defineAdrawCanvas } from "../index"

const TAG = "adraw-test-canvas"

defineAdrawCanvas(TAG)

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

describe("adraw-canvas element lifecycle", () => {
  it("loads initial content, mirrors the store and emits ready on connect", () => {
    const element = document.createElement(TAG) as AdrawCanvasElement
    const onReady = vi.fn()
    const readyEvent = vi.fn()
    element.onReady = onReady
    element.addEventListener("adraw:ready", readyEvent)
    element.options = { initialElements: [makeRect("a"), makeRect("b")] }

    document.body.append(element)

    expect(element.isReady).toBe(true)
    expect(element.canvas).toBeInstanceOf(AdrawCanvas)
    expect(element.store).not.toBeNull()
    expect([...element.elements.keys()]).toEqual(["a", "b"])
    expect(element.canvas?.getElements().size).toBe(2)
    expect(onReady).toHaveBeenCalledOnce()
    expect(onReady).toHaveBeenCalledWith(element.canvas)
    expect(readyEvent).toHaveBeenCalledOnce()

    element.remove()

    expect(element.isReady).toBe(false)
    expect(element.canvas).toBeInstanceOf(AdrawCanvas)
  })

  it("keeps the document and engine across reconnect", () => {
    const element = document.createElement(TAG) as AdrawCanvasElement
    const onReady = vi.fn()
    const readyEvent = vi.fn()
    element.onReady = onReady
    element.addEventListener("adraw:ready", readyEvent)
    element.options = { initialElements: [makeRect("a")] }

    document.body.append(element)
    const canvas = element.canvas
    canvas?.setActiveTool("rectangle")

    element.remove()
    document.body.append(element)

    expect(element.canvas).toBe(canvas)
    expect(element.canvas?.getElements().has("a")).toBe(true)
    expect(element.isReady).toBe(true)
    expect(onReady).toHaveBeenCalledTimes(2)
    expect(readyEvent).toHaveBeenCalledTimes(2)
  })

  it("mirrors state changes and re-dispatches them", () => {
    const element = document.createElement(TAG) as AdrawCanvasElement
    const change = vi.fn()
    element.addEventListener("adraw:change", change)
    document.body.append(element)

    element.canvas?.addElement(makeRect("a"))

    expect(element.elements.has("a")).toBe(true)
    expect(change).toHaveBeenCalled()

    element.remove()
  })
})
