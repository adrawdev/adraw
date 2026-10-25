import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import {
  createArrow,
  createDiamond,
  createRectangle,
  createText,
} from "../elements"
import { approximateTextMeasurer } from "../text"
import { syncTextBindings } from "../text-bindings"
import type {
  ArrowElement,
  CanvasElement,
  DiamondElement,
  RectangleElement,
  TextElement,
} from "../types"

function makeRect(overrides: Partial<RectangleElement> = {}): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 40,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

function makeArrow(overrides: Partial<ArrowElement> = {}): ArrowElement {
  return createArrow({
    endX: 100,
    endY: 0,
    height: 1,
    locked: false,
    rotation: 0,
    startX: 0,
    startY: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

function makeLabel(
  containerId: string,
  overrides: Partial<TextElement> = {},
): TextElement {
  return createText({
    autoSize: true,
    containerId,
    fontSize: 20,
    height: 25,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    text: "hello world",
    textAlign: "center",
    visible: true,
    width: 120,
    x: 0,
    y: 0,
    zIndex: 1,
    ...overrides,
  })
}

function mapOf(elements: CanvasElement[]): Map<string, CanvasElement> {
  return new Map(elements.map((element) => [element.id, element]))
}

describe("syncTextBindings", () => {
  it("wraps, centers and grows a shape label", () => {
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", { id: "label" })
    const elements = mapOf([rect, label])

    syncTextBindings(elements, approximateTextMeasurer)

    const resized = elements.get("rect") as RectangleElement
    const text = elements.get("label") as TextElement
    // Inner width 90: "hello world" wraps into two 60px lines, 50px tall.
    // The box shrinks to the longest line (60px) and the 40px-tall rectangle
    // grows to 60px so the label fits vertically.
    expect(resized.height).toBe(60)
    expect(text.autoSize).toBe(false)
    expect(text.wrapWidth).toBe(90)
    expect(text.width).toBe(60)
    expect(text.height).toBe(50)
    expect(text.x).toBe(20)
    expect(text.y).toBe(5)
  })

  it("wraps, centers and grows a diamond label", () => {
    const diamond = createDiamond({
      height: 100,
      id: "diamond",
      locked: false,
      rotation: 0,
      strokeColor: "#000",
      strokeWidth: 2,
      visible: true,
      width: 200,
      x: 0,
      y: 0,
      zIndex: 0,
    })
    const label = makeLabel("diamond", { id: "label" })
    const elements = mapOf([diamond, label])

    syncTextBindings(elements, approximateTextMeasurer)

    const resized = elements.get("diamond") as DiamondElement
    const text = elements.get("label") as TextElement
    // The inscribed rectangle is half the diamond's size: 90px wide after
    // padding, so "hello world" wraps into two 60px lines (50px tall). The
    // 40px-tall inner space grows the diamond to 120px.
    expect(resized.width).toBe(200)
    expect(resized.height).toBe(120)
    expect(text.autoSize).toBe(false)
    expect(text.wrapWidth).toBe(90)
    expect(text.width).toBe(60)
    expect(text.height).toBe(50)
    expect(text.x).toBe(70)
    expect(text.y).toBe(35)
  })

  it("follows the container when it moves and rotates", () => {
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", {
      id: "label",
      text: "Hi",
    })
    const elements = mapOf([rect, label])
    syncTextBindings(elements, approximateTextMeasurer)

    elements.set("rect", { ...rect, x: 200 })
    syncTextBindings(elements, approximateTextMeasurer)

    const moved = elements.get("label") as TextElement
    expect(moved.x).toBe(238)

    const currentRect = elements.get("rect") as RectangleElement
    elements.set("rect", { ...currentRect, rotation: 90 })
    syncTextBindings(elements, approximateTextMeasurer)

    const rotated = elements.get("label") as TextElement
    expect(rotated.rotation).toBe(90)
  })

  it("centers arrow labels on the line and repositions them when it moves", () => {
    const arrow = makeArrow({ id: "arrow" })
    const label = makeLabel("arrow", {
      autoSize: true,
      id: "label",
      labelPosition: 0.5,
      text: "A",
      width: 12,
    })
    const elements = mapOf([arrow, label])
    syncTextBindings(elements, approximateTextMeasurer)

    const centered = elements.get("label") as TextElement
    expect(centered.autoSize).toBe(true)
    expect(centered.width).toBeCloseTo(12)
    expect(centered.x).toBeCloseTo(44)
    expect(centered.y).toBeCloseTo(-12.5)

    elements.set("arrow", {
      ...(elements.get("arrow") as ArrowElement),
      endX: 200,
      width: 200,
    })
    syncTextBindings(elements, approximateTextMeasurer)

    const shifted = elements.get("label") as TextElement
    expect(shifted.x).toBeCloseTo(94)
  })

  it("removes labels whose container disappeared", () => {
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", { id: "label" })
    const elements = mapOf([rect, label])

    elements.delete("rect")
    syncTextBindings(elements, approximateTextMeasurer)

    expect(elements.has("label")).toBe(false)
  })

  it("deletes a container's label when the container is deleted", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", { id: "label", text: "Hi" })
    canvas.addElement(rect)
    canvas.addElement(label)
    canvas.setSelectedIds(new Set(["rect"]))

    canvas.deleteSelected()

    expect(canvas.getElements().has("rect")).toBe(false)
    expect(canvas.getElements().has("label")).toBe(false)
  })

  it("copies a container's label and remaps the binding on paste", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", { id: "label", text: "Hi" })
    canvas.addElement(rect)
    canvas.addElement(label)
    canvas.setSelectedIds(new Set(["rect"]))

    const copied = canvas.copy()
    expect(copied.map((element) => element.type).toSorted()).toEqual([
      "rectangle",
      "text",
    ])

    const pasted = canvas.paste({ x: 300, y: 200 })
    const pastedRect = pasted.find(
      (element) => element.type === "rectangle",
    ) as RectangleElement
    const pastedText = pasted.find(
      (element) => element.type === "text",
    ) as TextElement

    expect(pastedText.containerId).toBe(pastedRect.id)
    expect(pastedText.x).toBeGreaterThan(pastedRect.x)
    expect(pastedText.y).toBeGreaterThan(pastedRect.y)
  })

  it("moves a label with its container through z-order changes", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", { id: "label", text: "Hi" })
    const other = makeRect({ id: "other", x: 200, zIndex: 10 })
    canvas.addElement(rect)
    canvas.addElement(label)
    canvas.addElement(other)

    canvas.bringToFront("rect")

    const frontRect = canvas.getElements().get("rect") as RectangleElement
    const frontLabel = canvas.getElements().get("label") as TextElement
    const otherRect = canvas.getElements().get("other") as RectangleElement
    expect(frontRect.zIndex).toBeGreaterThan(otherRect.zIndex)
    expect(frontLabel.zIndex).toBeGreaterThan(otherRect.zIndex)
    expect(frontLabel.zIndex).toBeGreaterThan(frontRect.zIndex)
  })

  it("applies text options to the label of a selected shape", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRect({ id: "rect" })
    const label = makeLabel("rect", { id: "label" })
    canvas.addElement(rect)
    canvas.addElement(label)
    canvas.setSelectedIds(new Set(["rect"]))

    canvas.setStyle({ fontSize: 30 })

    const text = canvas.getElements().get("label") as TextElement
    const container = canvas.getElements().get("rect") as RectangleElement
    expect(text.fontSize).toBe(30)
    expect(text.wrapWidth).toBe(90)
    expect(text.width).toBe(90)
    expect(text.height).toBe(75)
    expect(container.height).toBe(85)
  })
})
