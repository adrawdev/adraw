// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas, type AdrawCanvasOptions } from "../canvas"
import { createRectangle } from "../elements"
import type { RectangleElement } from "../types"

function keydown(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  })
}

function addRect(instance: AdrawCanvas, id = "rect"): RectangleElement {
  const rect = createRectangle({
    cornerRadius: 0,
    height: 20,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    visible: true,
    width: 20,
    x: 10,
    y: 20,
    zIndex: 1,
  })
  instance.addElement(rect, { history: false })
  instance.setSelectedIds(new Set([id]))
  return rect
}

describe("keyboard scope and teardown", () => {
  let container: HTMLDivElement
  let canvas: AdrawCanvas | null = null

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    )
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    canvas?.destroy()
    canvas = null
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  function mount(options: AdrawCanvasOptions = {}) {
    const instance = new AdrawCanvas({ container, ...options })
    canvas = instance
    const svg = container.querySelector("svg")
    if (!svg) {
      throw new Error("canvas did not mount")
    }
    return { canvas: instance, svg: svg as SVGSVGElement }
  }

  it("scopes shortcuts to the focused canvas by default", () => {
    const { canvas: instance, svg } = mount()

    expect(svg.tabIndex).toBe(0)

    document.dispatchEvent(keydown({ key: "r" }))
    expect(instance.getActiveTool()).toBe("select")

    svg.dispatchEvent(keydown({ key: "r" }))
    expect(instance.getActiveTool()).toBe("rectangle")
  })

  it("toggles the tool lock with Q", () => {
    const { canvas: instance, svg } = mount()

    expect(instance.getIsToolLocked()).toBe(false)

    svg.dispatchEvent(keydown({ key: "q" }))
    expect(instance.getIsToolLocked()).toBe(true)

    svg.dispatchEvent(keydown({ key: "Q" }))
    expect(instance.getIsToolLocked()).toBe(false)
  })

  it("duplicates the selection with Ctrl/Cmd+D", () => {
    const { canvas: instance, svg } = mount()
    const rect = addRect(instance)

    const event = keydown({ ctrlKey: true, key: "d" })
    svg.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(instance.getElements().size).toBe(2)
    const clone = [...instance.getElements().values()].find(
      (element) => element.id !== rect.id,
    )!
    expect(clone).toMatchObject({ x: rect.x + 20, y: rect.y + 20 })
    expect([...instance.getSelectedIds()]).toEqual([clone.id])
  })

  it("nudges the selection with arrow keys", () => {
    const { canvas: instance, svg } = mount()
    const rect = addRect(instance)

    const right = keydown({ key: "ArrowRight" })
    svg.dispatchEvent(right)
    expect(right.defaultPrevented).toBe(true)
    expect(instance.getElements().get(rect.id)?.x).toBe(rect.x + 1)

    const down = keydown({ key: "ArrowDown", shiftKey: true })
    svg.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(instance.getElements().get(rect.id)?.y).toBe(rect.y + 10)
  })

  it("does not consume arrow keys when nothing is selected", () => {
    const { svg } = mount()

    const event = keydown({ key: "ArrowRight" })
    svg.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it("zooms with Ctrl/Cmd +, - and 0", () => {
    const { canvas: instance, svg } = mount()
    instance.setViewport({ x: 10, y: 20, zoom: 1.5 })

    const zoomIn = keydown({ ctrlKey: true, key: "=" })
    svg.dispatchEvent(zoomIn)
    expect(zoomIn.defaultPrevented).toBe(true)
    const afterIn = instance.getViewport().zoom
    expect(afterIn).toBeGreaterThan(1.5)

    const plus = keydown({ ctrlKey: true, key: "+" })
    svg.dispatchEvent(plus)
    const afterPlus = instance.getViewport().zoom
    expect(afterPlus).toBeGreaterThan(afterIn)

    const zoomOut = keydown({ ctrlKey: true, key: "-" })
    svg.dispatchEvent(zoomOut)
    expect(zoomOut.defaultPrevented).toBe(true)
    expect(instance.getViewport().zoom).toBeLessThan(afterPlus)

    const reset = keydown({ ctrlKey: true, key: "0" })
    svg.dispatchEvent(reset)
    expect(reset.defaultPrevented).toBe(true)
    expect(instance.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it("ignores duplicate, nudge and zoom shortcuts in editable targets", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    const rect = addRect(instance)
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)

    const duplicate = keydown({ ctrlKey: true, key: "d" })
    textarea.dispatchEvent(duplicate)
    expect(duplicate.defaultPrevented).toBe(false)
    expect(instance.getElements().size).toBe(1)

    const right = keydown({ key: "ArrowRight" })
    textarea.dispatchEvent(right)
    expect(right.defaultPrevented).toBe(false)
    expect(instance.getElements().get(rect.id)?.x).toBe(rect.x)

    const zoom = keydown({ ctrlKey: true, key: "=" })
    textarea.dispatchEvent(zoom)
    expect(zoom.defaultPrevented).toBe(false)
    expect(instance.getViewport().zoom).toBe(1)
  })

  it("handles duplicate, nudge and zoom with keyboard: document", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    const rect = addRect(instance)

    const duplicate = keydown({ ctrlKey: true, key: "d" })
    document.dispatchEvent(duplicate)
    expect(duplicate.defaultPrevented).toBe(true)
    expect(instance.getElements().size).toBe(2)

    const clone = [...instance.getElements().values()].find(
      (element) => element.id !== rect.id,
    )!
    const right = keydown({ key: "ArrowRight" })
    document.dispatchEvent(right)
    expect(right.defaultPrevented).toBe(true)
    expect(instance.getElements().get(clone.id)?.x).toBe(clone.x + 1)

    const zoom = keydown({ ctrlKey: true, key: "=" })
    document.dispatchEvent(zoom)
    expect(instance.getViewport().zoom).toBeGreaterThan(1)
  })

  it("focuses the canvas on pointer down", () => {
    const { svg } = mount()
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    svg.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
      }),
    )

    expect(document.activeElement).toBe(svg)
  })

  it("handles shortcuts document-wide with keyboard: document", () => {
    const { canvas: instance, svg } = mount({ keyboard: "document" })

    expect(svg.hasAttribute("tabindex")).toBe(false)

    document.dispatchEvent(keydown({ key: "e" }))
    expect(instance.getActiveTool()).toBe("eraser")
  })

  it("leaves form controls alone with keyboard: document", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    const input = document.createElement("input")
    document.body.appendChild(input)

    const undo = keydown({ ctrlKey: true, key: "z" })
    input.dispatchEvent(undo)

    expect(undo.defaultPrevented).toBe(false)
    expect(instance.getActiveTool()).toBe("select")
  })

  it("ignores selects and contenteditable targets with keyboard: document", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    const select = document.createElement("select")
    select.appendChild(document.createElement("option"))
    document.body.appendChild(select)

    const toolKey = keydown({ key: "r" })
    select.dispatchEvent(toolKey)

    expect(toolKey.defaultPrevented).toBe(false)
    expect(instance.getActiveTool()).toBe("select")

    const editable = document.createElement("div")
    editable.contentEditable = "true"
    const child = document.createElement("span")
    child.textContent = "finding"
    editable.appendChild(child)
    document.body.appendChild(editable)

    const undo = keydown({ ctrlKey: true, key: "z" })
    child.dispatchEvent(undo)

    expect(undo.defaultPrevented).toBe(false)
    expect(instance.getActiveTool()).toBe("select")
  })

  it("disables built-in shortcuts with keyboard: none", () => {
    const { canvas: instance, svg } = mount({ keyboard: "none" })

    expect(svg.hasAttribute("tabindex")).toBe(false)

    document.dispatchEvent(keydown({ key: "r" }))
    svg.dispatchEvent(keydown({ key: "e" }))

    expect(instance.getActiveTool()).toBe("select")
  })

  it("removes the document listener on destroy", () => {
    const { canvas: instance } = mount({ keyboard: "document" })

    document.dispatchEvent(keydown({ key: "r" }))
    expect(instance.getActiveTool()).toBe("rectangle")

    instance.destroy()
    document.dispatchEvent(keydown({ key: "e" }))

    expect(instance.getActiveTool()).toBe("rectangle")
  })

  it("does not stack listeners when destroyed and mounted again", () => {
    const { canvas: instance } = mount({ keyboard: "document" })
    instance.destroy()
    instance.mount(container)

    const handleKeyDown = vi.spyOn(instance, "handleKeyDown")
    document.dispatchEvent(keydown({ key: "e" }))

    expect(handleKeyDown).toHaveBeenCalledTimes(1)
  })
})
