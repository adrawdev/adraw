import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createLine, createRectangle, createText } from "../elements"
import { ADRAW_ERROR_CODES, AdrawError, type AdrawErrorCode } from "../errors"
import type { LineElement, RectangleElement, TextElement } from "../types"

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

function line(id: string): LineElement {
  return createLine({
    endX: 100,
    endY: 50,
    height: 50,
    id,
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
    zIndex: 1,
  })
}

function text(id: string, overrides: Partial<TextElement> = {}): TextElement {
  return createText({
    autoSize: true,
    fontSize: 20,
    height: 25,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    text: "Hello",
    visible: true,
    width: 60,
    x: 0,
    y: 0,
    zIndex: 2,
    ...overrides,
  })
}

function setup(): AdrawCanvas {
  const canvas = new AdrawCanvas()
  canvas.addElement(
    [
      rectangle("rect"),
      line("line"),
      text("text"),
      rectangle("container", { height: 100, width: 100 }),
      text("label", { containerId: "container", text: "Hi" }),
    ],
    { history: false },
  )
  return canvas
}

function expectCode(run: () => unknown, code: AdrawErrorCode): AdrawError {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(AdrawError)
    const adrawError = error as AdrawError
    expect(adrawError.code).toBe(code)
    return adrawError
  }
  throw new Error(`expected AdrawError with code ${code}`)
}

describe("AdrawError", () => {
  it("carries a stable code, hint, details and cause", () => {
    const cause = new Error("root")
    const error = new AdrawError("invalid-option", "bad option", {
      cause,
      details: { option: "offset" },
      hint: "Use a finite value.",
    })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AdrawError)
    expect(error.name).toBe("AdrawError")
    expect(error.message).toBe("bad option")
    expect(error.code).toBe("invalid-option")
    expect(error.hint).toBe("Use a finite value.")
    expect(error.details).toEqual({ option: "offset" })
    expect(error.cause).toBe(cause)
  })

  it("exports the complete list of stable codes", () => {
    expect(new Set(ADRAW_ERROR_CODES).size).toBe(ADRAW_ERROR_CODES.length)
    expect(ADRAW_ERROR_CODES).toContain("invalid-reference")
    expect(ADRAW_ERROR_CODES).toContain("not-mounted")
  })

  it("uses structured errors for update validation", () => {
    const canvas = setup()

    const unknown = expectCode(
      () => canvas.updateElement("rect", { foo: 1 } as never),
      "unknown-field",
    )
    expect(unknown.details).toMatchObject({
      elementType: "rectangle",
      field: "foo",
    })

    expectCode(
      () => canvas.updateElement("rect", { id: "other" } as never),
      "immutable-field",
    )
    expectCode(
      () => canvas.updateElement("rect", null as never),
      "invalid-argument",
    )
    expectCode(
      () => canvas.updateElement("rect", { x: "10" } as never),
      "invalid-field-type",
    )
    expectCode(
      () => canvas.updateElement("rect", { width: 0 }),
      "invalid-field-value",
    )
    expectCode(
      () => canvas.updateElement("line", { width: 100 }),
      "derived-field",
    )
    expectCode(
      () => canvas.updateElement("text", { containerId: "missing" }),
      "invalid-reference",
    )
    expectCode(
      () =>
        canvas.updateElements([
          { id: "rect", patch: { x: 1 } },
          { id: "rect", patch: { y: 1 } },
        ]),
      "invalid-argument",
    )
    expectCode(() => canvas.updateElements(null as never), "invalid-argument")
  })

  it("uses structured errors for options and shortcuts", () => {
    const canvas = setup()

    const offset = expectCode(
      () => canvas.duplicate("rect", { offset: { x: Number.NaN, y: 0 } }),
      "invalid-option",
    )
    expect(offset.details).toMatchObject({ option: "offset" })
    expect(offset.hint).toMatch(/finite/)

    expectCode(
      () => canvas.nudge("rect", { x: Number.NaN, y: 0 }),
      "invalid-option",
    )
    expectCode(
      () => canvas.align("rect", "diagonal" as never),
      "unknown-alignment",
    )
    expectCode(
      () => canvas.distribute("rect", "diagonal" as never),
      "unknown-axis",
    )

    const asyncError = expectCode(
      () => canvas.batch(async () => {}),
      "async-callback",
    )
    expect(asyncError.hint).toMatch(/synchronous/)
  })

  it("uses structured errors for z-order and media validation", () => {
    const canvas = setup()

    expectCode(() => canvas.setZIndex("rect", Number.NaN), "invalid-z-index")
    expectCode(
      () =>
        canvas.insertMedia(
          {
            mimeType: "image/png",
            naturalHeight: 10,
            naturalWidth: 10,
            src: "data:image/png;base64,",
          },
          { zIndex: Number.POSITIVE_INFINITY },
        ),
      "invalid-z-index",
    )
  })

  it("uses structured errors for derived bound-text flags", () => {
    const canvas = setup()

    const error = expectCode(
      () => canvas.setVisible("label", false),
      "derived-field",
    )
    expect(error.details).toMatchObject({
      elementType: "text",
      field: "visible",
      reason: "bound-text",
    })
    expect(error.hint).toMatch(/container/)
  })

  it("uses structured errors when the canvas is not mounted", async () => {
    const canvas = new AdrawCanvas()

    await expect(canvas.toImage()).rejects.toMatchObject({
      code: "not-mounted",
      name: "AdrawError",
    })
  })
})
