import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"

// Pointer events in tests only need the modifier flags the tools read and the
// anchor lookup the select tool performs on `event.target`.
function pointerEvent(
  modifiers: {
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
  } = {},
  anchor: string | null = null,
): PointerEvent {
  return {
    altKey: modifiers.altKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    target: {
      getAttribute: (name: string) => (name === "data-anchor" ? anchor : null),
    },
  } as unknown as PointerEvent
}

function makeRect(x: number, y: number) {
  return createRectangle({
    cornerRadius: 0,
    height: 100,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 2,
    visible: true,
    width: 100,
    x,
    y,
    zIndex: 0,
  })
}

function seededCanvas(options: { isSnapMode?: boolean } = {}) {
  const canvas = new AdrawCanvas({
    isSnapMode: options.isSnapMode,
    snapping: { threshold: 5 },
  })
  const target = makeRect(300, 0)
  const mover = makeRect(0, 0)
  canvas.getElements().set(target.id, target)
  canvas.getElements().set(mover.id, mover)
  return { canvas, mover, target }
}

describe("snapping gestures", () => {
  it("snaps a dragged element's edge to another element while Ctrl is held", () => {
    const { canvas, mover } = seededCanvas()

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(347, 60, pointerEvent({ ctrlKey: true }))

    expect(canvas.getElements().get(mover.id)!.x).toBe(300)
    expect(
      canvas
        .getSnapGuides()
        .some((g) => g.type === "vertical" && g.position === 300),
    ).toBe(true)

    canvas.handlePointerUp(347, 60, pointerEvent())
    expect(canvas.getSnapGuides()).toEqual([])
  })

  it("treats Cmd like Ctrl", () => {
    const { canvas, mover } = seededCanvas()

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(347, 60, pointerEvent({ metaKey: true }))

    expect(canvas.getElements().get(mover.id)!.x).toBe(300)
  })

  it("does not snap without a modifier", () => {
    const { canvas, mover } = seededCanvas()

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(347, 60, pointerEvent())

    expect(canvas.getElements().get(mover.id)!.x).toBe(297)
    expect(canvas.getSnapGuides()).toEqual([])
  })

  it("snaps without a modifier when isSnapMode is on", () => {
    const { canvas, mover } = seededCanvas({ isSnapMode: true })

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(347, 60, pointerEvent())

    expect(canvas.getElements().get(mover.id)!.x).toBe(300)
  })

  it("needs no snapping configuration to snap with Ctrl", () => {
    const canvas = new AdrawCanvas()
    const target = makeRect(300, 0)
    const mover = makeRect(0, 0)
    canvas.getElements().set(target.id, target)
    canvas.getElements().set(mover.id, mover)

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(347, 60, pointerEvent({ ctrlKey: true }))

    expect(canvas.getElements().get(mover.id)!.x).toBe(300)
  })

  it("snaps a resized edge to another element while Ctrl is held", () => {
    const { canvas, mover } = seededCanvas()

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerUp(50, 50, pointerEvent())
    canvas.handlePointerDown(100, 50, pointerEvent({}, "right-center"))
    canvas.handlePointerMove(303, 50, pointerEvent({ ctrlKey: true }))

    const resized = canvas.getElements().get(mover.id)!
    expect(resized.width).toBe(300)
    expect(resized.x).toBe(0)
    expect(
      canvas
        .getSnapGuides()
        .some((g) => g.type === "vertical" && g.position === 300),
    ).toBe(true)
  })

  it("hides guides for axes an edge handle doesn't resize", () => {
    const { canvas } = seededCanvas()

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerUp(50, 50, pointerEvent())
    canvas.handlePointerDown(100, 50, pointerEvent({}, "right-center"))
    // The pointer only moves vertically, near the target's center line, but a
    // right-center handle doesn't change height — no horizontal guide.
    canvas.handlePointerMove(100, 52, pointerEvent({ ctrlKey: true }))

    expect(canvas.getSnapGuides()).toEqual([])
  })

  it("snaps a newly drawn rectangle's corner while Ctrl is held", () => {
    const canvas = new AdrawCanvas({
      snapping: { threshold: 5 },
    })
    const target = makeRect(100, 100)
    canvas.getElements().set(target.id, target)
    canvas.setActiveTool("rectangle")

    canvas.handlePointerDown(10, 10, pointerEvent())
    canvas.handlePointerMove(103, 202, pointerEvent({ ctrlKey: true }))

    const temporary = canvas.getTemporaryElement()
    expect(temporary).not.toBeNull()
    expect(temporary!.x).toBe(10)
    expect(temporary!.width).toBe(90)
    expect(temporary!.height).toBe(190)
    expect(
      canvas
        .getSnapGuides()
        .map((g) => g.type)
        .toSorted(),
    ).toEqual(["horizontal", "vertical"])

    canvas.handlePointerUp(103, 202, pointerEvent({ ctrlKey: true }))

    const created = [...canvas.getElements().values()].find(
      (element) => element.id !== target.id,
    )!
    expect(created.x).toBe(10)
    expect(created.width).toBe(90)
    expect(created.height).toBe(190)
  })
})
