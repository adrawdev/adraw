import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { serializeDocument } from "../document"
import { createGroup, createRectangle } from "../elements"
import type {
  CanvasDocument,
  CanvasElement,
  GroupElement,
  RectangleElement,
} from "../types"
import fixtureText from "./fixtures/documents/v1.json?raw"

function rectangle(
  id: string,
  overrides: Partial<RectangleElement> = {},
): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height: 20,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    visible: true,
    width: 20,
    x: 0,
    y: 0,
    zIndex: 1,
    ...overrides,
  })
}

function setup(elements: CanvasElement[]): AdrawCanvas {
  const canvas = new AdrawCanvas()
  canvas.addElement(elements, { history: false })
  return canvas
}

describe("deterministic document serialization", () => {
  it("sorts elements by zIndex and then id", () => {
    const canvas = setup([
      rectangle("b", { zIndex: 2 }),
      rectangle("a", { zIndex: 1 }),
      rectangle("c", { zIndex: 1 }),
    ])

    const doc = canvas.toDocument({ deterministic: true })

    expect(doc.elements.map((element) => element.id)).toEqual(["a", "c", "b"])
  })

  it("emits identical JSON for the same content in different insertion orders", () => {
    const a = rectangle("a", { zIndex: 2 })
    const b = rectangle("b", { zIndex: 1 })

    const forward = setup([a, b])
    const reverse = setup([b, a])

    expect(serializeDocument(forward.toDocument())).toBe(
      serializeDocument(reverse.toDocument()),
    )
    expect(serializeDocument(forward.toDocument({ deterministic: true }))).toBe(
      serializeDocument(reverse.toDocument({ deterministic: true })),
    )
  })

  it("canonicalizes object key order", () => {
    const original = rectangle("rect")
    const reversed = Object.fromEntries(
      Object.entries(original).toReversed(),
    ) as RectangleElement

    const first = setup([original])
    const second = setup([reversed])

    expect(serializeDocument(first.toDocument())).toBe(
      serializeDocument(second.toDocument()),
    )
  })

  it("canonicalizes group child order", () => {
    const a = rectangle("a", { zIndex: 1 })
    const b = rectangle("b", { zIndex: 2 })
    const makeGroup = (children: string[]): GroupElement =>
      createGroup({
        children,
        height: 0,
        id: "group",
        locked: false,
        rotation: 0,
        visible: true,
        width: 0,
        x: 0,
        y: 0,
        zIndex: 3,
      })

    const first = setup([a, b, makeGroup(["b", "a"])])
    const second = setup([a, b, makeGroup(["a", "b"])])

    expect(serializeDocument(first.toDocument())).toBe(
      serializeDocument(second.toDocument()),
    )

    const group = first
      .toDocument({ deterministic: true })
      .elements.find((element) => element.type === "group") as GroupElement
    expect(group.children).toEqual(["a", "b"])
  })

  it("round-trips a document with every element type", () => {
    const fixture = JSON.parse(fixtureText) as CanvasDocument
    const canvas = new AdrawCanvas()
    canvas.loadDocument(fixture)

    const first = canvas.toDocument({ deterministic: true })
    const second = new AdrawCanvas()
    second.loadDocument(first)
    const roundTripped = second.toDocument({ deterministic: true })

    expect(serializeDocument(roundTripped)).toBe(serializeDocument(first))
  })

  it("keeps insertion order by default until 1.0", () => {
    const canvas = setup([
      rectangle("b", { zIndex: 2 }),
      rectangle("a", { zIndex: 1 }),
    ])

    expect(canvas.toDocument().elements.map((element) => element.id)).toEqual([
      "b",
      "a",
    ])
    expect(
      canvas
        .toDocument({ deterministic: true })
        .elements.map((element) => element.id),
    ).toEqual(["a", "b"])
  })

  it("exposes the same behavior through toJSON", () => {
    const canvas = setup([rectangle("a")])

    expect(serializeDocument(canvas.toJSON({ deterministic: true }))).toBe(
      serializeDocument(canvas.toDocument({ deterministic: true })),
    )
  })

  it("supports deterministic serialization with exclude", () => {
    const canvas = setup([
      rectangle("a", { zIndex: 1 }),
      rectangle("b", { zIndex: 2 }),
    ])

    const doc = canvas.toDocument({
      deterministic: true,
      exclude: (element) => element.id === "b",
    })

    expect(doc.elements.map((element) => element.id)).toEqual(["a"])
  })

  it("does not mutate the source document", () => {
    const canvas = setup([rectangle("b", { zIndex: 2 }), rectangle("a")])
    const doc = canvas.toDocument()
    const before = JSON.stringify(doc)

    serializeDocument(doc)

    expect(JSON.stringify(doc)).toBe(before)
  })
})
