import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "../constants"
import { createText } from "../elements"
import {
  approximateLineWidth,
  getTextAnchor,
  getTextLeading,
  getTextLines,
  getTextLineX,
  measureTextLayout,
  type TextLayoutOptions,
} from "../text"
import type { TextElement } from "../types"

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return createText({
    fontSize: 20,
    height: 25,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    text: "Hello",
    visible: true,
    width: 60,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

describe("measureTextLayout", () => {
  it("uses the default family and line height", () => {
    const layout = measureTextLayout("Hello", { fontSize: 20 })

    expect(layout.lines).toEqual(["Hello"])
    expect(layout.width).toBe(approximateLineWidth("Hello", 20))
    expect(layout.height).toBe(20 * TEXT_LINE_HEIGHT)
  })

  it("only breaks auto-sized text on explicit newlines", () => {
    const layout = measureTextLayout("a very long line", {
      autoSize: true,
      fontSize: 20,
      maxWidth: 10,
    })

    expect(layout.lines).toEqual(["a very long line"])
    expect(layout.width).toBeGreaterThan(10)
  })

  it("wraps fixed-width text and keeps the requested width", () => {
    const layout = measureTextLayout("hello world", {
      autoSize: false,
      fontSize: 20,
      maxWidth: 70,
    })

    expect(layout.lines).toEqual(["hello", "world"])
    expect(layout.width).toBe(70)
    expect(layout.height).toBe(2 * 20 * TEXT_LINE_HEIGHT)
  })

  it("shrinks the box to the longest wrapped line when requested", () => {
    const layout = measureTextLayout("hello world", {
      autoSize: false,
      fontSize: 20,
      maxWidth: 70,
      shrinkWidth: true,
    })

    expect(layout.lines).toEqual(["hello", "world"])
    expect(layout.width).toBe(60)
    expect(layout.height).toBe(2 * 20 * TEXT_LINE_HEIGHT)
  })

  it("breaks words that are wider than the wrap width", () => {
    const layout = measureTextLayout("abcdef", {
      autoSize: false,
      fontSize: 10,
      maxWidth: 20,
    })

    expect(layout.lines.length).toBeGreaterThan(1)
    expect(layout.lines.join("")).toBe("abcdef")
  })

  it("honours a custom line measurer", () => {
    const measurer = (text: string) => text.length * 10
    const layout = measureTextLayout(
      "abcd",
      { autoSize: false, fontSize: 20, maxWidth: 20 },
      measurer,
    )

    expect(layout.lines).toEqual(["ab", "cd"])
    expect(layout.height).toBe(2 * 20 * TEXT_LINE_HEIGHT)
  })
})

describe("text layout helpers", () => {
  it("resolves alignment anchors and line positions", () => {
    expect(getTextAnchor({ textAlign: "left" })).toBe("start")
    expect(getTextAnchor({ textAlign: "center" })).toBe("middle")
    expect(getTextAnchor({ textAlign: "right" })).toBe("end")
    expect(getTextLineX({ textAlign: "left", width: 100 })).toBe(0)
    expect(getTextLineX({ textAlign: "center", width: 100 })).toBe(50)
    expect(getTextLineX({ textAlign: "right", width: 100 })).toBe(100)
  })

  it("derives the half-leading from the line height", () => {
    expect(getTextLeading(makeText({ fontSize: 20 }))).toBe(2.5)
    expect(getTextLeading(makeText({ fontSize: 20, lineHeight: 1 }))).toBe(0)
  })

  it("uses explicit lines for auto-sized text and wrapped lines otherwise", () => {
    expect(getTextLines(makeText({ text: "a\nb" }))).toEqual(["a", "b"])
    expect(
      getTextLines(
        makeText({ autoSize: false, text: "hello world", width: 70 }),
      ),
    ).toEqual(["hello", "world"])
  })
})

describe("engine text measurer", () => {
  it("re-measures existing text when a custom measurer is installed", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(makeText({ id: "text" }))

    canvas.setTextMeasurer((text, options: TextLayoutOptions) => ({
      height: options.fontSize,
      lines: text.split("\n"),
      width: text.length * 10,
    }))

    const updated = canvas.getElements().get("text") as TextElement
    expect(updated.width).toBe(50)
    expect(updated.height).toBe(20)
  })

  it("keeps fixed-width text at its width and updates only its height", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(
      makeText({
        autoSize: false,
        height: 25,
        id: "text",
        text: "hello world",
        width: 70,
      }),
    )

    canvas.setTextMeasurer((text, options: TextLayoutOptions) => {
      const lines = [text.slice(0, 5), text.slice(6)]
      return {
        height: lines.length * options.fontSize,
        lines,
        width: options.maxWidth ?? 0,
      }
    })

    const updated = canvas.getElements().get("text") as TextElement
    expect(updated.width).toBe(70)
    expect(updated.height).toBe(40)
  })

  it("uses the configured font family for the default measurer", () => {
    const canvas = new AdrawCanvas()
    canvas.setStyle({ fontFamily: "monospace" })
    const options = canvas.getStyle()

    expect(options.fontFamily).toBe("monospace")
    expect(options.fontFamily).not.toBe(TEXT_FONT_FAMILY)
  })
})
