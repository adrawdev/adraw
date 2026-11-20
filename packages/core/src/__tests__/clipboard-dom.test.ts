// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas, type AdrawCanvasOptions } from "../canvas"
import { createRectangle } from "../elements"
import type { CanvasElement, RectangleElement } from "../types"

const ADRAW_CLIPBOARD_TYPE = "application/x-adraw+json"

class FakeClipboardData {
  private readonly data = new Map<string, string>()

  get types(): string[] {
    return [...this.data.keys()]
  }

  getData(type: string): string {
    return this.data.get(type) ?? ""
  }

  setData(type: string, value: string): void {
    this.data.set(type, value)
  }
}

function clipboardEvent(
  type: string,
  data: FakeClipboardData | null,
): ClipboardEvent {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent
  Object.defineProperty(event, "clipboardData", { value: data })
  return event
}

function makeRect(id = "rect-1"): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 100,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    zIndex: 0,
  })
}

type MountOptions = Omit<AdrawCanvasOptions, "container">

function mount(options: MountOptions = {}) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
    },
  )
  const container = document.createElement("div")
  document.body.appendChild(container)
  const canvas = new AdrawCanvas({ container, ...options })
  canvas.setCanvasSize(800, 600)
  const svg = container.querySelector("svg")!
  return { canvas, container, svg }
}

function clickCanvas(svg: SVGSVGElement, x: number, y: number): void {
  for (const type of ["pointerdown", "pointerup"] as const) {
    svg.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
      }),
    )
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe("DOM clipboard integration", () => {
  it("writes structured and plain payloads and pastes them into another canvas", () => {
    const source = mount()
    source.canvas.addElement(makeRect())
    source.canvas.selectAll()
    const data = new FakeClipboardData()

    const copy = clipboardEvent("copy", data)
    source.svg.dispatchEvent(copy)

    const structured = data.getData(ADRAW_CLIPBOARD_TYPE)
    expect(copy.defaultPrevented).toBe(true)
    expect(structured).not.toBe("")
    expect(data.getData("text/plain")).toBe(structured)
    expect(JSON.parse(structured)).toMatchObject({
      elements: [{ id: "rect-1", type: "rectangle" }],
      type: "adraw/clipboard",
      version: 1,
    })

    const target = mount()
    target.svg.dispatchEvent(clipboardEvent("paste", data))

    expect(target.canvas.getElements().size).toBe(1)
    expect([...target.canvas.getElements().values()][0].id).not.toBe("rect-1")
  })

  it("cuts to the system clipboard and removes the selection", () => {
    const source = mount()
    source.canvas.addElement(makeRect())
    source.canvas.selectAll()
    const data = new FakeClipboardData()

    const cut = clipboardEvent("cut", data)
    source.svg.dispatchEvent(cut)

    expect(cut.defaultPrevented).toBe(true)
    expect(source.canvas.getElements().size).toBe(0)
    expect(data.getData(ADRAW_CLIPBOARD_TYPE)).not.toBe("")

    const target = mount()
    target.svg.dispatchEvent(clipboardEvent("paste", data))
    expect(target.canvas.getElements().size).toBe(1)
  })

  it("prefers the structured payload and falls back to plain JSON", () => {
    const source = mount()
    source.canvas.addElement(makeRect())
    source.canvas.selectAll()
    const copy = new FakeClipboardData()
    source.svg.dispatchEvent(clipboardEvent("copy", copy))
    const payload = copy.getData(ADRAW_CLIPBOARD_TYPE)

    const structured = new FakeClipboardData()
    structured.setData(ADRAW_CLIPBOARD_TYPE, payload)
    structured.setData("text/plain", "external text")
    const first = mount()
    first.svg.dispatchEvent(clipboardEvent("paste", structured))
    expect(first.canvas.getElements().size).toBe(1)

    const plain = new FakeClipboardData()
    plain.setData(ADRAW_CLIPBOARD_TYPE, "not json")
    plain.setData("text/plain", payload)
    const second = mount()
    second.svg.dispatchEvent(clipboardEvent("paste", plain))
    expect(second.canvas.getElements().size).toBe(1)
  })

  it("falls back to the in-memory clipboard when access is denied", () => {
    const { canvas, svg } = mount()
    canvas.addElement(makeRect())
    canvas.selectAll()

    svg.dispatchEvent(clipboardEvent("copy", null))
    expect(canvas.serializeClipboard()).not.toBeNull()

    svg.dispatchEvent(clipboardEvent("paste", null))
    expect(canvas.getElements().size).toBe(2)
  })

  it("uses custom serialization hooks for system payloads", () => {
    const serialize = (elements: CanvasElement[]): string =>
      `custom:${JSON.stringify(elements)}`
    const deserialize = (data: string): CanvasElement[] | null =>
      data.startsWith("custom:")
        ? (JSON.parse(data.slice("custom:".length)) as CanvasElement[])
        : null

    const source = mount({ clipboard: { serialize } })
    source.canvas.addElement(makeRect())
    source.canvas.selectAll()
    const data = new FakeClipboardData()
    source.svg.dispatchEvent(clipboardEvent("copy", data))

    expect(data.getData(ADRAW_CLIPBOARD_TYPE).startsWith("custom:")).toBe(true)
    expect(data.getData("text/plain")).toBe(data.getData(ADRAW_CLIPBOARD_TYPE))

    const target = mount({ clipboard: { deserialize } })
    target.svg.dispatchEvent(clipboardEvent("paste", data))
    expect(target.canvas.getElements().size).toBe(1)
  })

  it("does not paste stale canvas content over external text", () => {
    const { canvas, svg } = mount()
    canvas.addElement(makeRect())
    canvas.selectAll()
    svg.dispatchEvent(clipboardEvent("copy", null))

    const external = new FakeClipboardData()
    external.setData("text/plain", "hello from another app")
    const paste = clipboardEvent("paste", external)
    svg.dispatchEvent(paste)

    expect(canvas.getElements().size).toBe(1)
    expect(paste.defaultPrevented).toBe(false)
  })

  it("leaves text fields and the inline text editor to native behavior", () => {
    const { canvas, svg } = mount({ keyboard: "document" })
    canvas.addElement(makeRect())
    canvas.selectAll()

    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    const fieldData = new FakeClipboardData()
    textarea.dispatchEvent(clipboardEvent("copy", fieldData))
    expect(fieldData.types).toEqual([])
    expect(canvas.serializeClipboard()).toBeNull()
    textarea.remove()

    canvas.setActiveTool("text")
    clickCanvas(svg, 300, 300)
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    const editorData = new FakeClipboardData()
    editor!.dispatchEvent(clipboardEvent("copy", editorData))
    expect(editorData.types).toEqual([])
  })

  it("can be disabled while keeping the keyboard shortcut fallback", () => {
    const { canvas, svg } = mount({ clipboard: { system: false } })
    canvas.addElement(makeRect())
    canvas.selectAll()

    const data = new FakeClipboardData()
    svg.dispatchEvent(clipboardEvent("copy", data))
    expect(data.types).toEqual([])
    expect(canvas.serializeClipboard()).toBeNull()

    const key = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "c",
    })
    svg.dispatchEvent(key)

    expect(key.defaultPrevented).toBe(true)
    expect(canvas.serializeClipboard()).not.toBeNull()
  })

  it("defers Ctrl/Cmd+C, X and V to the native clipboard events", () => {
    const { canvas, svg } = mount()
    canvas.addElement(makeRect())
    canvas.selectAll()
    const copy = vi.spyOn(canvas, "copy")

    const key = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "c",
    })
    Object.defineProperty(key, "isTrusted", { value: true })
    svg.dispatchEvent(key)
    expect(key.defaultPrevented).toBe(false)
    expect(copy).not.toHaveBeenCalled()

    // Programmatic key events cannot produce native clipboard events, so the
    // adapter keeps the in-memory shortcut path for them.
    const synthetic = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "c",
    })
    svg.dispatchEvent(synthetic)
    expect(synthetic.defaultPrevented).toBe(true)
    expect(copy).toHaveBeenCalledOnce()
  })
})
