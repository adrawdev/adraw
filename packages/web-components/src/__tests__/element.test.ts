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
  it("loads initial content and emits ready on connect", () => {
    const element = document.createElement(TAG) as AdrawCanvasElement
    const onReady = vi.fn()
    const readyEvent = vi.fn()
    element.onReady = onReady
    element.addEventListener("adraw:ready", readyEvent)
    element.options = { initialElements: [makeRect("a"), makeRect("b")] }

    document.body.append(element)

    expect(element.isReady).toBe(true)
    expect(element.canvas).toBeInstanceOf(AdrawCanvas)
    expect([...element.elements.keys()]).toEqual(["a", "b"])
    expect(element.canvas?.getElements().size).toBe(2)
    expect(onReady).toHaveBeenCalledOnce()
    expect(onReady).toHaveBeenCalledWith(element.canvas)
    expect(readyEvent).toHaveBeenCalledOnce()

    element.remove()

    expect(element.isReady).toBe(false)
    expect(element.canvas).toBeNull()
  })
})
