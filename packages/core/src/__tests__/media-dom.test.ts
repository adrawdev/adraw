// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas, type AdrawCanvasOptions } from "../canvas"
import type { MediaElement } from "../types"

class FakeFileReader {
  result: string | null = null
  error: DOMException | null = null
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null

  readAsDataURL(blob: Blob): void {
    const name = (blob as File).name
    if (name.includes("read-error")) {
      this.error = new DOMException("read failed", "NotReadableError")
      queueMicrotask(() => this.onerror?.({} as ProgressEvent<FileReader>))
      return
    }
    this.result = `data:${blob.type};base64,${name}`
    queueMicrotask(() =>
      this.onload?.({ target: this } as unknown as ProgressEvent<FileReader>),
    )
  }
}

class FakeImage {
  naturalWidth = 0
  naturalHeight = 0
  width = 0
  height = 0
  onload: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  set src(value: string) {
    const name = value.split(",")[1] ?? ""
    if (name.includes("broken")) {
      queueMicrotask(() => this.onerror?.(new Event("error")))
      return
    }
    const dimensions = /(?<width>\d+)x(?<height>\d+)/.exec(name)
    this.naturalWidth = Number(dimensions?.groups?.width ?? 400)
    this.naturalHeight = Number(dimensions?.groups?.height ?? 200)
    this.width = this.naturalWidth
    this.height = this.naturalHeight
    queueMicrotask(() => this.onload?.(new Event("load")))
  }
}

class FakeDataTransfer {
  dropEffect = "none"
  readonly files: File[]
  readonly items: {
    kind: string
    getAsFile: () => File | null
  }[]
  readonly types: string[]

  constructor(files: File[]) {
    this.files = files
    this.items = files.map((file) => ({
      getAsFile: () => file,
      kind: "file",
    }))
    this.types = files.length > 0 ? ["Files"] : []
  }

  getData(): string {
    return ""
  }

  setData(): void {}
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
  return { canvas, container }
}

function dropEvent(
  data: FakeDataTransfer,
  clientX = 400,
  clientY = 300,
): DragEvent {
  const event = new Event("drop", {
    bubbles: true,
    cancelable: true,
  }) as DragEvent
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: data },
  })
  return event
}

function pasteEvent(data: FakeDataTransfer): ClipboardEvent {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent
  Object.defineProperty(event, "clipboardData", { value: data })
  return event
}

function imageFile(name: string, type = "image/png"): File {
  return new File(["image"], name, { type })
}

async function waitFor(check: () => boolean, remaining = 50): Promise<void> {
  if (check()) {
    return
  }
  if (remaining <= 0) {
    throw new Error("condition not met")
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
  return waitFor(check, remaining - 1)
}

function mediaElements(canvas: AdrawCanvas): MediaElement[] {
  return [...canvas.getElements().values()].filter(
    (element): element is MediaElement => element.type === "media",
  )
}

beforeEach(() => {
  vi.stubGlobal("FileReader", FakeFileReader)
  vi.stubGlobal("Image", FakeImage)
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe("media drop and paste", () => {
  it("inserts a dropped image centered on the drop point", async () => {
    const { canvas, container } = mount()
    const event = dropEvent(
      new FakeDataTransfer([imageFile("photo-400x200.png")]),
    )

    container.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => mediaElements(canvas).length === 1)
    const [image] = mediaElements(canvas)
    expect(image).toMatchObject({
      mimeType: "image/png",
      naturalHeight: 200,
      naturalWidth: 400,
    })
    expect(image.width / image.height).toBeCloseTo(2)
    expect(image.x + image.width / 2).toBeCloseTo(0)
    expect(image.y + image.height / 2).toBeCloseTo(0)
    expect(canvas.getSelectedIds()).toEqual(new Set([image.id]))
  })

  it("inserts multiple images centered on the drop point", async () => {
    const { canvas, container } = mount()
    const event = dropEvent(
      new FakeDataTransfer([
        imageFile("wide-400x200.png"),
        imageFile("tall-100x300.png", "image/webp"),
      ]),
    )

    container.dispatchEvent(event)

    await waitFor(() => mediaElements(canvas).length === 2)
    const [first, second] = mediaElements(canvas)
    expect(first.mimeType).toBe("image/png")
    expect(second.mimeType).toBe("image/webp")
    expect(first.width / first.height).toBeCloseTo(2)
    expect(second.width / second.height).toBeCloseTo(100 / 300)
    expect(first.x + first.width / 2).toBeCloseTo(0)
    expect(first.y + first.height / 2).toBeCloseTo(0)
    expect(second.x + second.width / 2).toBeCloseTo(0)
    expect(second.y + second.height / 2).toBeCloseTo(0)
  })

  it("prevents native file drops", () => {
    const { container } = mount()
    const data = new FakeDataTransfer([imageFile("photo.png")])
    const event = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(event, "dataTransfer", { value: data })

    container.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it("prevents native navigation for dropped image URLs", () => {
    const { container } = mount()
    const data = new FakeDataTransfer([])
    data.types.push("text/uri-list")
    const event = dropEvent(data)

    container.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it("ignores unsupported files with a clear warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { canvas, container } = mount()

    const data = new FakeDataTransfer([
      new File(["notes"], "notes.txt", {
        type: "text/plain",
      }),
    ])
    container.dispatchEvent(dropEvent(data))

    await waitFor(() => warn.mock.calls.length > 0)
    expect(mediaElements(canvas)).toHaveLength(0)
    expect(warn.mock.calls[0][0]).toContain('ignored "notes.txt"')
    expect(warn.mock.calls[0][0]).toContain("unsupported-type")
  })

  it("filters accepted types and warns for rejected files", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { canvas, container } = mount({ media: { accept: ["image/png"] } })

    const data = new FakeDataTransfer([
      imageFile("photo.jpg", "image/jpeg"),
      imageFile("photo.png"),
    ])
    container.dispatchEvent(dropEvent(data))

    await waitFor(() => mediaElements(canvas).length === 1)
    expect(mediaElements(canvas)[0].mimeType).toBe("image/png")
    expect(warn.mock.calls[0][0]).toContain("unsupported-type")
  })

  it("reports unreadable and undecodable files", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { canvas, container } = mount()
    const data = new FakeDataTransfer([
      imageFile("read-error.png"),
      imageFile("broken.png"),
    ])
    container.dispatchEvent(dropEvent(data))

    await waitFor(() => warn.mock.calls.length === 2)
    expect(
      warn.mock.calls
        .map((call) => String(call[0]))
        .toSorted()
        .join(" "),
    ).toContain("invalid-image")
    expect(warn.mock.calls.map(String).join(" ")).toContain("read-error")
    expect(mediaElements(canvas)).toHaveLength(0)
  })

  it("can be disabled", async () => {
    const { canvas, container } = mount({ media: { enabled: false } })
    const data = new FakeDataTransfer([imageFile("photo.png")])
    const dragover = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as DragEvent
    Object.defineProperty(dragover, "dataTransfer", { value: data })
    const drop = dropEvent(data)

    container.dispatchEvent(dragover)
    container.dispatchEvent(drop)

    expect(dragover.defaultPrevented).toBe(false)
    expect(drop.defaultPrevented).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mediaElements(canvas)).toHaveLength(0)
  })

  it("inserts pasted images at the last pointer position", async () => {
    const { canvas, container } = mount()
    canvas.setPointerPoint({ x: 30, y: 40 })
    const svg = container.querySelector("svg")!
    const event = pasteEvent(
      new FakeDataTransfer([imageFile("pasted-200x100.png")]),
    )

    svg.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => mediaElements(canvas).length === 1)
    const [image] = mediaElements(canvas)
    expect(image.x + image.width / 2).toBeCloseTo(30)
    expect(image.y + image.height / 2).toBeCloseTo(40)
  })

  it("leaves image paste in text fields and the inline editor alone", async () => {
    const { canvas, container } = mount({ keyboard: "document" })
    const svg = container.querySelector("svg")!
    const data = new FakeDataTransfer([imageFile("pasted.png")])

    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    textarea.dispatchEvent(pasteEvent(data))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mediaElements(canvas)).toHaveLength(0)

    canvas.setActiveTool("text")
    for (const type of ["pointerdown", "pointerup"]) {
      svg.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: 300,
          clientY: 300,
          pointerId: 1,
        }),
      )
    }
    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    editor!.dispatchEvent(pasteEvent(data))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mediaElements(canvas)).toHaveLength(0)
  })
})
