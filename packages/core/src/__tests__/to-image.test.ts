// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { NOTE_SHADOW_OVERHANG } from "../constants"
import {
  createArrow,
  createGroup,
  createLine,
  createNote,
  createRectangle,
  createText,
} from "../elements"
import type { RectangleElement } from "../types"

function makeRect(overrides: Partial<RectangleElement> = {}): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 50,
    locked: false,
    rotation: 0,
    strokeColor: "#000000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

function mount(): { canvas: AdrawCanvas; container: HTMLElement } {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
    },
  )
  const container = document.createElement("div")
  document.body.appendChild(container)
  const canvas = new AdrawCanvas({ container })
  canvas.setCanvasSize(800, 600)
  return { canvas, container }
}

async function exportSvg(
  canvas: AdrawCanvas,
  options: Parameters<AdrawCanvas["toImage"]>[0] = {},
): Promise<SVGSVGElement> {
  const blob = await canvas.toImage({ format: "svg", ...options })
  const text = await blob.text()
  return new DOMParser().parseFromString(text, "image/svg+xml")
    .documentElement as unknown as SVGSVGElement
}

function childElementIds(svg: SVGSVGElement): string[] {
  return [...svg.children]
    .filter((child) => child.tagName === "g")
    .map((child) => child.id)
}

function backgroundRects(svg: SVGSVGElement): Element[] {
  return [...svg.children].filter(
    (child) => child.tagName === "rect" && !child.id,
  )
}

describe("toImage", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  it("draws elements in z-index order and includes locked ones", async () => {
    const { canvas } = mount()
    const back = makeRect({ id: "back", zIndex: 1 })
    const front = makeRect({ id: "front", locked: true, zIndex: 5 })
    const hidden = makeRect({ id: "hidden", visible: false, zIndex: 9 })
    canvas.addElement([front, hidden, back], { history: false })

    const svg = await exportSvg(canvas)

    expect(childElementIds(svg)).toEqual(["back", "front"])
  })

  it("omits excluded elements from both the drawing and the bounds", async () => {
    const { canvas } = mount()
    const kept = makeRect({ id: "kept", strokeWidth: 0, zIndex: 0 })
    const excluded = makeRect({
      id: "excluded",
      strokeWidth: 0,
      x: 500,
      y: 500,
      zIndex: 1,
    })
    canvas.addElement([kept, excluded], { history: false })

    const svg = await exportSvg(canvas, {
      exclude: (element) => element.id === "excluded",
      padding: 10,
    })

    expect(childElementIds(svg)).toEqual(["kept"])
    expect(svg.getAttribute("viewBox")).toBe("-10 -10 120 70")
  })

  it("uses rotation-aware bounds including stroke overhang", async () => {
    const { canvas } = mount()
    canvas.addElement(makeRect({ rotation: 90, strokeWidth: 0, x: 0, y: 0 }), {
      history: false,
    })

    const svg = await exportSvg(canvas)
    const viewBox = svg
      .getAttribute("viewBox")!
      .split(" ")
      .map((value) => Number(value))

    expect(viewBox[0]).toBeCloseTo(25)
    expect(viewBox[1]).toBeCloseTo(-25)
    expect(viewBox[2]).toBeCloseTo(50)
    expect(viewBox[3]).toBeCloseTo(100)
  })

  it("keeps note shadows inside the exported region", async () => {
    const { canvas } = mount()
    canvas.addElement(
      createNote({
        cornerRadius: 10,
        fillColor: "#fde68a",
        fontSize: 20,
        height: 100,
        locked: false,
        padding: 16,
        rotation: 0,
        strokeColor: "#111",
        text: "",
        visible: true,
        width: 100,
        x: 0,
        y: 0,
        zIndex: 0,
      }),
      { history: false },
    )

    const svg = await exportSvg(canvas)
    const group = svg.querySelector("g[id]")!
    expect(group.getAttribute("style")).toContain("drop-shadow")
    expect(svg.getAttribute("viewBox")).toBe(
      `${-NOTE_SHADOW_OVERHANG} ${-NOTE_SHADOW_OVERHANG} ${100 + NOTE_SHADOW_OVERHANG * 2} ${100 + NOTE_SHADOW_OVERHANG * 2}`,
    )
  })

  it("keeps a horizontal line from collapsing to a 1px-tall region", async () => {
    const { canvas } = mount()
    canvas.addElement(
      createLine({
        endX: 100,
        endY: 0,
        height: 0,
        locked: false,
        rotation: 0,
        startX: 0,
        startY: 0,
        strokeColor: "#000000",
        strokeWidth: 4,
        visible: true,
        width: 100,
        x: 0,
        y: 0,
        zIndex: 0,
      }),
      { history: false },
    )

    const svg = await exportSvg(canvas)

    expect(svg.getAttribute("viewBox")).toBe("-2 -2 104 4")
  })

  it("exports only the selection, its bounds and stroke overhang", async () => {
    const { canvas } = mount()
    const selected = makeRect({
      id: "selected",
      locked: true,
      strokeWidth: 2,
    })
    const other = makeRect({
      id: "other",
      strokeWidth: 0,
      x: 500,
      y: 500,
      zIndex: 1,
    })
    canvas.addElement([selected, other], { history: false })
    canvas.setSelectedIds(new Set(["selected"]))

    const svg = await exportSvg(canvas, { selection: true })

    expect(childElementIds(svg)).toEqual(["selected"])
    expect(svg.getAttribute("viewBox")).toBe("-1 -1 102 52")
  })

  it("includes bound text and arrow labels of selected elements", async () => {
    const { canvas } = mount()
    const rect = makeRect({ height: 100, id: "rect", strokeWidth: 0 })
    const label = createText({
      autoSize: true,
      containerId: rect.id,
      fontSize: 20,
      height: 20,
      id: "label",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      text: "hello",
      visible: true,
      width: 40,
      x: 30,
      y: 40,
      zIndex: 1,
    })
    const arrow = createArrow({
      endX: 300,
      endY: 10,
      height: 1,
      id: "arrow",
      locked: false,
      rotation: 0,
      startX: 200,
      startY: 10,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 100,
      x: 200,
      y: 10,
      zIndex: 2,
    })
    const arrowLabel = createText({
      autoSize: true,
      containerId: arrow.id,
      fontSize: 20,
      height: 15,
      id: "arrow-label",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      text: "arrow",
      visible: true,
      width: 30,
      x: 235,
      y: 0,
      zIndex: 3,
    })
    const other = makeRect({ id: "other", x: 500, y: 500, zIndex: 4 })
    canvas.addElement([rect, label, arrow, arrowLabel, other], {
      history: false,
    })
    canvas.setSelectedIds(new Set([rect.id, arrow.id]))

    const svg = await exportSvg(canvas, { selection: true })

    expect(childElementIds(svg)).toEqual([
      "rect",
      "label",
      "arrow",
      "arrow-label",
    ])
  })

  it("expands a selected group to its children", async () => {
    const { canvas } = mount()
    const first = makeRect({ id: "first", strokeWidth: 0 })
    const second = makeRect({ id: "second", strokeWidth: 0, x: 200, zIndex: 1 })
    const group = createGroup({
      children: [first.id, second.id],
      height: 50,
      id: "group",
      locked: false,
      rotation: 0,
      visible: true,
      width: 300,
      x: 0,
      y: 0,
      zIndex: 2,
    })
    canvas.addElement([first, second, group], { history: false })
    canvas.setSelectedIds(new Set([group.id]))

    const svg = await exportSvg(canvas, { selection: true })

    expect(childElementIds(svg)).toEqual(["first", "second"])
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 50")
  })

  it("returns a 1x1 image when the selection has no visible elements", async () => {
    const { canvas } = mount()
    const hidden = makeRect({ id: "hidden", visible: false })
    canvas.addElement(hidden, { history: false })

    const empty = await exportSvg(canvas, { selection: true })
    expect(childElementIds(empty)).toEqual([])
    expect(empty.getAttribute("viewBox")).toBe("0 0 1 1")

    canvas.setSelectedIds(new Set([hidden.id]))
    const hiddenOnly = await exportSvg(canvas, { selection: true })
    expect(childElementIds(hiddenOnly)).toEqual([])
    expect(hiddenOnly.getAttribute("viewBox")).toBe("0 0 1 1")
  })

  it("paints an explicit background color", async () => {
    const { canvas } = mount()
    canvas.addElement(makeRect(), { history: false })

    const svg = await exportSvg(canvas, { background: "#ff0000" })
    const rects = backgroundRects(svg)

    expect(rects).toHaveLength(1)
    expect(rects[0].getAttribute("fill")).toBe("#ff0000")
  })

  it("does not paint a background by default", async () => {
    const { canvas } = mount()
    canvas.addElement(makeRect(), { history: false })

    const svg = await exportSvg(canvas)

    expect(backgroundRects(svg)).toHaveLength(0)
  })

  it("returns a valid 1x1 SVG when nothing is exported", async () => {
    const { canvas } = mount()

    const svg = await exportSvg(canvas)

    expect(svg.tagName).toBe("svg")
    expect(svg.getAttribute("viewBox")).toBe("0 0 1 1")
  })
})
