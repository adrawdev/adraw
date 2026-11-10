import { describe, expect, it } from "vitest"

import {
  AdrawCanvas,
  AdrawError,
  AdrawStore,
  createRectangle,
  migrateDocument,
  serializeDocument,
  validateDocument,
} from "../index"
import type { RectangleElement } from "../types"

function rectangle(id = "rect-1"): RectangleElement {
  return createRectangle({
    cornerRadius: 8,
    fillColor: "#ffd43b",
    height: 120,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#111111",
    strokeWidth: 2,
    visible: true,
    width: 200,
    x: 0,
    y: 0,
    zIndex: 1,
  })
}

describe("agent guide workflow", () => {
  it("runs the headless document lifecycle", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(rectangle())

    const store = new AdrawStore(canvas)
    const revisions: number[] = []
    store.subscribe(() => {
      revisions.push(store.getSnapshot().revision)
    })

    canvas.updateElement("rect-1", { fillColor: "#ff8787" })
    expect(revisions).toHaveLength(1)

    const json = serializeDocument(canvas.toDocument({ deterministic: true }))
    const parsed: unknown = JSON.parse(json)

    expect(validateDocument(parsed).valid).toBe(true)

    const migrated = migrateDocument(parsed)
    const restored = new AdrawCanvas({
      initialDocument: migrated,
      validateDocuments: true,
    })

    expect(restored.getElements().has("rect-1")).toBe(true)
    store.dispose()
  })

  it("surfaces structured errors for invalid updates", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(rectangle())

    try {
      canvas.updateElement("rect-1", { width: 0 })
      throw new Error("expected updateElement to throw")
    } catch (error) {
      expect(error).toBeInstanceOf(AdrawError)
      expect((error as AdrawError).code).toBe("invalid-field-value")
      expect((error as AdrawError).details).toMatchObject({
        field: "width",
      })
    }
  })

  it("uses batch for multi-step edits", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(rectangle())

    canvas.batch(() => {
      canvas.updateElement("rect-1", { fillColor: "#b2f2bb" })
      canvas.setLocked("rect-1", true)
    })

    expect(canvas.getElements().get("rect-1")).toMatchObject({
      fillColor: "#b2f2bb",
      locked: true,
    })
    expect(canvas.canUndo()).toBe(true)
  })
})
