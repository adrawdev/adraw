import { describe, expect, it } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle } from "../elements"

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

function makeRect(id: string, x: number, y: number) {
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
    x,
    y,
    zIndex: 0,
  })
}

describe("grid snapping gestures", () => {
  it("snaps a newly created shape without a modifier", () => {
    const canvas = new AdrawCanvas({ grid: { size: 20, snap: true } })
    canvas.setActiveTool("rectangle")

    canvas.handlePointerDown(13, 17, pointerEvent())
    canvas.handlePointerMove(47, 63, pointerEvent())

    expect(canvas.getTemporaryElement()).toMatchObject({
      height: 40,
      width: 20,
      x: 20,
      y: 20,
    })
    expect(canvas.getSnapGuides()).toEqual([])

    canvas.handlePointerUp(47, 63, pointerEvent())

    expect([...canvas.getElements().values()][0]).toMatchObject({
      height: 40,
      width: 20,
      x: 20,
      y: 20,
    })
  })

  it("does not snap when the grid is visible but snapping is off", () => {
    const canvas = new AdrawCanvas({ grid: { enabled: true, snap: false } })
    canvas.setActiveTool("rectangle")

    canvas.handlePointerDown(13, 17, pointerEvent())
    canvas.handlePointerMove(47, 63, pointerEvent())

    expect(canvas.getTemporaryElement()).toMatchObject({
      height: 46,
      width: 34,
      x: 13,
      y: 17,
    })
  })

  it("snaps a moved selection even when the grid is hidden", () => {
    const mover = makeRect("mover", 13, 17)
    const canvas = new AdrawCanvas({
      grid: { enabled: false, size: 20, snap: true },
      initialElements: [mover],
    })

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(63, 67, pointerEvent())

    expect(canvas.getElements().get("mover")).toMatchObject({ x: 20, y: 40 })
    expect(canvas.getSnapGuides()).toEqual([])
  })

  it("prefers element snapping per axis and fills the other axis from the grid", () => {
    const target = makeRect("target", 300, 0)
    const mover = makeRect("mover", 0, 0)
    const canvas = new AdrawCanvas({
      grid: { size: 20, snap: true },
      initialElements: [target, mover],
      snapping: { threshold: 5 },
    })

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(347, 63, pointerEvent({ ctrlKey: true }))

    expect(canvas.getElements().get("mover")).toMatchObject({ x: 300, y: 20 })
    expect(
      canvas.getSnapGuides().map((guide) => [guide.type, guide.position]),
    ).toEqual([["vertical", 300]])
  })

  it("snaps a resized edge to the grid", () => {
    const mover = makeRect("mover", 0, 0)
    const canvas = new AdrawCanvas({
      grid: { size: 20, snap: true },
      initialElements: [mover],
    })

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerUp(50, 50, pointerEvent())
    canvas.handlePointerDown(100, 50, pointerEvent({}, "right-center"))
    canvas.handlePointerMove(137, 50, pointerEvent())

    expect(canvas.getElements().get("mover")).toMatchObject({
      width: 140,
      x: 0,
    })
  })
})
