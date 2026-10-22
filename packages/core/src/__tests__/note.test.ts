// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import {
  NOTE_CORNER_RADIUS,
  NOTE_FILL_COLOR,
  NOTE_PADDING,
  NOTE_SHADOW,
  NOTE_SIZE,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
} from "../constants"
import { createNote } from "../elements"
import type { NoteElement } from "../types"

function pointerEvent(): PointerEvent {
  return {
    ctrlKey: false,
    shiftKey: false,
    target: {
      getAttribute: () => null,
    },
  } as unknown as PointerEvent
}

function firstNote(canvas: AdrawCanvas): NoteElement {
  const element = [...canvas.getElements().values()].find(
    (candidate) => candidate.type === "note",
  )
  if (element?.type !== "note") {
    throw new Error("No note element")
  }
  return element
}

function mount(): {
  canvas: AdrawCanvas
  container: HTMLElement
  svg: SVGSVGElement
} {
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
  return {
    canvas,
    container,
    svg: container.querySelector("svg")!,
  }
}

describe("note tool", () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it("places a default-sized note centered on the click", () => {
    const canvas = new AdrawCanvas()
    canvas.setActiveTool("note")

    canvas.handlePointerDown(0, 0, pointerEvent())
    expect(canvas.getTemporaryElement()).toBeNull()
    expect(canvas.getElements().size).toBe(0)

    canvas.handlePointerUp(0, 0, pointerEvent())

    const note = firstNote(canvas)
    expect(note.width).toBe(NOTE_SIZE)
    expect(note.height).toBe(NOTE_SIZE)
    expect(note.x).toBe(-NOTE_SIZE / 2)
    expect(note.y).toBe(-NOTE_SIZE / 2)
    expect(note.fillColor).toBe(NOTE_FILL_COLOR)
    expect(note.cornerRadius).toBe(NOTE_CORNER_RADIUS)
    expect(note.padding).toBe(NOTE_PADDING)
    expect(note.fontSize).toBe(TEXT_FONT_SIZE)
    expect(note.textAlign).toBe("center")
    expect(canvas.getActiveTool()).toBe("select")
    expect(canvas.getSelectedIds().has(note.id)).toBe(true)
  })

  it("sizes the note when dragged", () => {
    const canvas = new AdrawCanvas()
    canvas.setActiveTool("note")

    canvas.handlePointerDown(10, 20, pointerEvent())
    expect(canvas.getTemporaryElement()).toBeNull()

    canvas.handlePointerMove(210, 140, pointerEvent())
    expect(canvas.getTemporaryElement()).toMatchObject({
      height: 120,
      width: 200,
      x: 10,
      y: 20,
    })
    expect(canvas.getElements().size).toBe(0)

    canvas.handlePointerUp(210, 140, pointerEvent())

    const note = firstNote(canvas)
    expect(note.x).toBe(10)
    expect(note.y).toBe(20)
    expect(note.width).toBe(200)
    expect(note.height).toBe(120)
  })

  it("activates with the N shortcut", () => {
    const canvas = new AdrawCanvas()

    canvas.handleKeyDown(
      new KeyboardEvent("keydown", { bubbles: true, key: "n" }),
    )

    expect(canvas.getActiveTool()).toBe("note")
  })

  it("applies style to new and selected notes", () => {
    const canvas = new AdrawCanvas()
    canvas.setStyle({
      fillColor: "#bbf7d0",
      fontSize: 24,
      textAlign: "left",
    })
    canvas.setActiveTool("note")
    canvas.handlePointerDown(0, 0, pointerEvent())
    canvas.handlePointerUp(0, 0, pointerEvent())

    const note = firstNote(canvas)
    expect(note.fillColor).toBe("#bbf7d0")
    expect(note.fontSize).toBe(24)
    expect(note.textAlign).toBe("left")

    canvas.selectAll()
    canvas.setStyle({
      cornerRadius: 20,
      fillColor: "#fecaca",
      fontSize: 18,
      padding: 24,
    })

    const updated = firstNote(canvas)
    expect(updated.fillColor).toBe("#fecaca")
    expect(updated.fontSize).toBe(18)
    expect(updated.cornerRadius).toBe(20)
    expect(updated.padding).toBe(24)
  })

  it("renders the sticky shape and edits its text inline", () => {
    const { canvas, container } = mount()
    const note = createNote({
      cornerRadius: NOTE_CORNER_RADIUS,
      fillColor: NOTE_FILL_COLOR,
      fontSize: TEXT_FONT_SIZE,
      height: NOTE_SIZE,
      lineHeight: TEXT_LINE_HEIGHT,
      locked: false,
      padding: NOTE_PADDING,
      rotation: 0,
      strokeColor: "#111",
      text: "Hello",
      textAlign: "center",
      visible: true,
      width: NOTE_SIZE,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    canvas.addElement(note)

    const group = container.querySelector(`[id="${note.id}"]`) as SVGGElement
    expect(group.style.filter).toBe(NOTE_SHADOW)
    expect(group.querySelector("rect")?.getAttribute("fill")).toBe(
      NOTE_FILL_COLOR,
    )
    expect(group.querySelector("path")?.getAttribute("d")).toBe(
      "M 172 200 L 190 200 A 10 10 0 0 0 200 190 L 200 172 Z",
    )
    expect(group.querySelector("text")?.getAttribute("text-anchor")).toBe(
      "middle",
    )
    expect(group.querySelector("text")?.textContent).toBe("Hello")

    // Double-click the note to edit it in place.
    const svg = container.querySelector("svg")!
    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 500,
        clientY: 400,
      }),
    )

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()
    expect(editor!.value).toBe("Hello")
    expect(editor!.style.textAlign).toBe("center")
    expect(editor!.style.fontSize).toBe(`${TEXT_FONT_SIZE}px`)
    // The sticky background stays visible while its painted text is hidden.
    expect(group.querySelector("rect")?.style.visibility).toBe("")
    expect(group.querySelector("text")?.style.visibility).toBe("hidden")

    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join(
      "\n",
    )
    editor!.value = lines
    editor!.dispatchEvent(new Event("input", { bubbles: true }))

    const updated = firstNote(canvas)
    expect(updated.text).toBe(lines)
    expect(updated.height).toBeGreaterThan(NOTE_SIZE)

    editor!.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "Enter",
      }),
    )

    expect(document.querySelector("textarea")).toBeNull()
    expect(canvas.getSelectedIds().has(note.id)).toBe(true)
    expect(group.querySelector("text")?.style.visibility).toBe("")
    expect(
      [...group.querySelectorAll("tspan")].map((line) => line.textContent),
    ).toEqual(lines.split("\n"))
  })

  it("keeps an empty note after committing its editor", () => {
    const { canvas, svg } = mount()
    canvas.setActiveTool("note")

    for (const type of ["pointerdown", "pointerup"] as const) {
      svg.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: 400,
          clientY: 300,
          pointerId: 1,
        }),
      )
    }

    const editor = document.querySelector<HTMLTextAreaElement>("textarea")
    expect(editor).not.toBeNull()

    editor!.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "Enter",
      }),
    )

    const note = firstNote(canvas)
    expect(note.text).toBe("")
    expect(canvas.getElements().has(note.id)).toBe(true)
    expect(canvas.getSelectedIds().has(note.id)).toBe(true)
  })
})
