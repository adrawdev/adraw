// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { findBindingTarget, resolveArrowElement } from "../bindings"
import { AdrawCanvas } from "../canvas"
import {
  createArrow,
  createGroup,
  createRectangle,
  createText,
  getElementAtPoint,
  getElementsBounds,
} from "../elements"
import type {
  ArrowElement,
  CanvasElement,
  GroupElement,
  RectangleElement,
  TextElement,
} from "../types"

function makeRect(
  id: string,
  x: number,
  y: number,
  width = 20,
  height = 20,
  zIndex = 1,
): RectangleElement {
  return createRectangle({
    cornerRadius: 0,
    height,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    strokeWidth: 1,
    visible: true,
    width,
    x,
    y,
    zIndex,
  })
}

function makeGroup(
  id: string,
  children: string[],
  overrides: Partial<GroupElement> = {},
): GroupElement {
  return createGroup({
    children,
    height: 0,
    id,
    locked: false,
    rotation: 0,
    visible: true,
    width: 0,
    x: 0,
    y: 0,
    zIndex: 0,
    ...overrides,
  })
}

function makeText(
  id: string,
  containerId: string,
  text = "Label",
): TextElement {
  return createText({
    containerId,
    fontSize: 16,
    height: 20,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#000",
    text,
    visible: true,
    width: 40,
    x: 0,
    y: 0,
    zIndex: 2,
  })
}

function pointerEvent(
  anchor: string | null = null,
  modifiers: {
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
  } = {},
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

function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  })
}

function setup(elements: CanvasElement[]): AdrawCanvas {
  const canvas = new AdrawCanvas()
  canvas.addElement(elements, { history: false })
  return canvas
}

function groupElement(canvas: AdrawCanvas, id: string): GroupElement {
  const element = canvas.getElements().get(id)
  if (element?.type !== "group") {
    throw new Error(`missing group ${id}`)
  }
  return element
}

describe("grouping", () => {
  it("creates a selected group with derived bounds and topmost-child z-index", () => {
    const canvas = new AdrawCanvas()
    const a = makeRect("a", 0, 0, 20, 20, 1)
    const b = makeRect("b", 40, 30, 20, 20, 5)
    canvas.addElement([a, b], { history: false })
    canvas.setSelectedIds(new Set(["a", "b"]))
    canvas.pushHistory()

    const group = canvas.group()

    expect(group).not.toBeNull()
    expect(new Set(group!.children)).toEqual(new Set(["a", "b"]))
    expect(group!.x).toBe(0)
    expect(group!.y).toBe(0)
    expect(group!.width).toBe(60)
    expect(group!.height).toBe(50)
    expect(group!.zIndex).toBe(5)
    expect(canvas.getSelectedIds()).toEqual(new Set([group!.id]))

    expect(canvas.undo()).toBe(true)
    expect(canvas.getElements().has(group!.id)).toBe(false)
    expect(canvas.getSelectedIds()).toEqual(new Set(["a", "b"]))

    expect(canvas.redo()).toBe(true)
    expect(canvas.getSelectedIds()).toEqual(new Set([group!.id]))
  })

  it("requires at least two objects", () => {
    const canvas = setup([makeRect("a", 0, 0)])
    canvas.setSelectedIds(new Set(["a"]))

    expect(canvas.group()).toBeNull()
    expect(canvas.getElements().size).toBe(1)
  })

  it("includes bound labels and a selected label's container", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRect("rect", 0, 0, 100, 60)
    const other = makeRect("other", 140, 0)
    const label = makeText("label", "rect")
    canvas.addElement([rect, other, label], { history: false })
    canvas.setSelectedIds(new Set(["rect", "other"]))

    const group = canvas.group()

    expect(group).not.toBeNull()
    expect(new Set(group!.children)).toEqual(
      new Set(["rect", "other", "label"]),
    )
  })

  it("does not group a single labeled container", () => {
    const canvas = new AdrawCanvas()
    const rect = makeRect("rect", 0, 0, 100, 60)
    const label = makeText("label", "rect")
    canvas.addElement([rect, label], { history: false })
    canvas.setSelectedIds(new Set(["rect"]))

    expect(canvas.group()).toBeNull()
  })

  it("groups inside the shared parent without flattening nested groups", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 30, 0)
    const c = makeRect("c", 60, 0)
    const outer = makeGroup("outer", ["a", "b", "c"])
    const canvas = setup([a, b, c, outer])
    canvas.setSelectedIds(new Set(["a", "b"]))

    const nested = canvas.group()

    expect(nested).not.toBeNull()
    const outerNow = groupElement(canvas, "outer")
    expect(outerNow.children).toContain(nested!.id)
    expect(outerNow.children).toContain("c")
    expect(outerNow.children).not.toContain("a")
    expect(canvas.getGroupContext()).toBe("outer")
    expect(canvas.getSelectedIds()).toEqual(new Set([nested!.id]))
  })

  it("reconstructs the entered context after undo and redo", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 30, 0)
    const c = makeRect("c", 60, 0)
    const outer = makeGroup("outer", ["a", "b", "c"])
    const canvas = setup([a, b, c, outer])
    canvas.setSelectedIds(new Set(["a", "b"]))
    canvas.pushHistory()

    const nested = canvas.group()
    expect(canvas.getGroupContext()).toBe("outer")

    canvas.undo()
    expect(canvas.getSelectedIds()).toEqual(new Set(["a", "b"]))
    expect(canvas.getGroupContext()).toBe("outer")

    canvas.redo()
    expect(canvas.getSelectedIds()).toEqual(new Set([nested!.id]))
    expect(canvas.getGroupContext()).toBe("outer")
  })

  it("normalizes cross-parent selections to the top level", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 30, 0)
    const x = makeRect("x", 100, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, x, outer])
    canvas.setSelectedIds(new Set(["a", "x"]))

    const group = canvas.group()

    expect(group).not.toBeNull()
    expect(new Set(group!.children)).toEqual(new Set(["outer", "x"]))
    expect(groupElement(canvas, "outer").children).toEqual(["a", "b"])
    expect(canvas.getGroupContext()).toBeNull()
  })

  it("ignores a selection that is already contained by a selected group", () => {
    const a = makeRect("a", 0, 0)
    const outer = makeGroup("outer", ["a"])
    const canvas = setup([a, outer])
    canvas.setSelectedIds(new Set(["outer", "a"]))

    expect(canvas.group()).toBeNull()
  })

  it("keeps group bounds in sync when a child moves or changes z-index", () => {
    const a = makeRect("a", 0, 0, 20, 20, 1)
    const b = makeRect("b", 40, 0, 20, 20, 1)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])

    canvas.commitScene(
      (draft) => {
        draft.elements.set("a", { ...a, x: 100, zIndex: 9 })
      },
      { history: false },
    )

    const outerNow = groupElement(canvas, "outer")
    expect(outerNow.x).toBe(40)
    expect(outerNow.width).toBe(80)
    expect(outerNow.zIndex).toBe(9)
  })
})

describe("ungrouping", () => {
  it("removes one level and selects the released children", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 30, 0)
    const c = makeRect("c", 60, 0)
    const inner = makeGroup("inner", ["a", "b"])
    const outer = makeGroup("outer", ["inner", "c"])
    const canvas = setup([a, b, c, inner, outer])
    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set(["inner"]))

    const released = canvas.ungroup()

    expect(new Set(released)).toEqual(new Set(["a", "b"]))
    expect(canvas.getElements().has("inner")).toBe(false)
    expect(groupElement(canvas, "outer").children).toEqual(["a", "b", "c"])
    expect(canvas.getSelectedIds()).toEqual(new Set(["a", "b"]))
    expect(canvas.getGroupContext()).toBe("outer")
  })

  it("leaves nested groups intact when ungrouping their parent", () => {
    const a = makeRect("a", 0, 0)
    const inner = makeGroup("inner", ["a"])
    const c = makeRect("c", 60, 0)
    const outer = makeGroup("outer", ["inner", "c"])
    const canvas = setup([a, c, inner, outer])
    canvas.setSelectedIds(new Set(["outer"]))

    const released = canvas.ungroup()

    expect(new Set(released)).toEqual(new Set(["inner", "c"]))
    expect(canvas.getElements().has("outer")).toBe(false)
    expect(canvas.getElements().has("inner")).toBe(true)
    expect(canvas.getSelectedIds()).toEqual(new Set(["inner", "c"]))
  })

  it("is a no-op without a selected group", () => {
    const canvas = setup([makeRect("a", 0, 0)])
    canvas.setSelectedIds(new Set(["a"]))

    expect(canvas.ungroup()).toEqual([])
    expect(canvas.getElements().has("a")).toBe(true)
  })
})

describe("group selection, drill-down and shortcuts", () => {
  it("selects the outermost group when clicking a child", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.clearSelection()

    canvas.handlePointerDown(10, 10, pointerEvent())
    canvas.handlePointerUp(10, 10, pointerEvent())

    expect(canvas.getSelectedIds()).toEqual(new Set(["outer"]))
  })

  it("selects direct children once the group is entered", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setGroupContext("outer")

    canvas.handlePointerDown(10, 10, pointerEvent())
    canvas.handlePointerUp(10, 10, pointerEvent())

    expect(canvas.getSelectedIds()).toEqual(new Set(["a"]))
    expect(canvas.getGroupContext()).toBe("outer")
  })

  it("Escape steps out one level before clearing", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set(["a"]))

    canvas.handleKeyDown(keyEvent({ key: "Escape" }))

    expect(canvas.getSelectedIds()).toEqual(new Set(["outer"]))
    expect(canvas.getGroupContext()).toBeNull()

    canvas.handleKeyDown(keyEvent({ key: "Escape" }))
    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("Select All acts on the entered group's direct children", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set())

    canvas.selectAll()

    expect(canvas.getSelectedIds()).toEqual(new Set(["a", "b"]))
    expect(canvas.getGroupContext()).toBe("outer")
  })

  it("Select All prefers top-level groups over their children", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])

    canvas.selectAll()

    expect(canvas.getSelectedIds()).toEqual(new Set(["outer"]))
  })

  it("marquee selects a top-level group only when it touches a child", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])

    // The box sits inside the group's union bounds but touches no child.
    canvas.handlePointerDown(28, 8, pointerEvent())
    canvas.handlePointerMove(32, 12, pointerEvent())
    expect(canvas.getSelectedIds().size).toBe(0)
    canvas.handlePointerUp(32, 12, pointerEvent())

    canvas.handlePointerDown(30, 10, pointerEvent())
    canvas.handlePointerMove(15, 10, pointerEvent())
    expect(canvas.getSelectedIds()).toEqual(new Set(["outer"]))
    canvas.handlePointerUp(15, 10, pointerEvent())
  })

  it("marquee inside a context selects direct children", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set())

    canvas.handlePointerDown(30, 10, pointerEvent())
    canvas.handlePointerMove(65, 25, pointerEvent())

    expect(canvas.getSelectedIds()).toEqual(new Set(["b"]))
    expect(canvas.getGroupContext()).toBe("outer")
  })

  it("leaves the context when clicking outside it, keeping the context for empty inside clicks", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const x = makeRect("x", 200, 200)
    const canvas = setup([a, b, x, outer])
    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set(["a"]))

    // Empty space inside the group keeps the context.
    canvas.handlePointerDown(30, 10, pointerEvent())
    canvas.handlePointerUp(30, 10, pointerEvent())
    expect(canvas.getSelectedIds().size).toBe(0)
    expect(canvas.getGroupContext()).toBe("outer")

    // Clicking a non-descendant leaves it.
    canvas.handlePointerDown(210, 210, pointerEvent())
    canvas.handlePointerUp(210, 210, pointerEvent())
    expect(canvas.getSelectedIds()).toEqual(new Set(["x"]))
    expect(canvas.getGroupContext()).toBeNull()
  })

  it("groups and ungroups with Ctrl/Cmd+G and Ctrl/Cmd+Shift+G", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const canvas = setup([a, b])
    canvas.setSelectedIds(new Set(["a", "b"]))

    const groupKey = keyEvent({ ctrlKey: true, key: "g" })
    canvas.handleKeyDown(groupKey)

    expect(groupKey.defaultPrevented).toBe(true)
    const group = [...canvas.getElements().values()].find(
      (element) => element.type === "group",
    )
    expect(group).toBeDefined()
    expect(canvas.getSelectedIds()).toEqual(new Set([group!.id]))

    canvas.handleKeyDown(keyEvent({ ctrlKey: true, key: "G", shiftKey: true }))

    expect(canvas.getElements().has(group!.id)).toBe(false)
    expect(canvas.getSelectedIds()).toEqual(new Set(["a", "b"]))
  })
})

describe("group transforms", () => {
  function grouped(): {
    canvas: AdrawCanvas
    a: RectangleElement
    b: RectangleElement
    group: GroupElement
  } {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const canvas = setup([a, b])
    canvas.setSelectedIds(new Set(["a", "b"]))
    const group = canvas.group()!
    return { a, b, canvas, group }
  }

  it("moves every descendant and updates the group bounds", () => {
    const { canvas, group } = grouped()

    canvas.handlePointerDown(10, 10, pointerEvent())
    canvas.handlePointerMove(30, 40, pointerEvent())

    expect(canvas.getElements().get("a")!.x).toBe(20)
    expect(canvas.getElements().get("a")!.y).toBe(30)
    expect(canvas.getElements().get("b")!.x).toBe(60)
    const groupNow = groupElement(canvas, group.id)
    expect(groupNow.x).toBe(20)
    expect(groupNow.y).toBe(30)
    expect(groupNow.width).toBe(60)
    expect(groupNow.height).toBe(20)
    expect(canvas.getSelectedIds()).toEqual(new Set([group.id]))
  })

  it("resizes descendants relative to the group bounds", () => {
    const { canvas, group } = grouped()

    canvas.handlePointerDown(60, 20, pointerEvent("bottom-right"))
    canvas.handlePointerMove(120, 40, pointerEvent("bottom-right"))

    expect(canvas.getElements().get("a")!.width).toBe(40)
    expect(canvas.getElements().get("a")!.height).toBe(40)
    expect(canvas.getElements().get("b")!.x).toBe(80)
    expect(canvas.getElements().get("b")!.width).toBe(40)
    const groupNow = groupElement(canvas, group.id)
    expect(groupNow.width).toBe(120)
    expect(groupNow.height).toBe(40)
  })

  it("rotates descendants around the group center", () => {
    const { canvas, group } = grouped()

    canvas.handlePointerDown(30, 0, pointerEvent("rotation"))
    canvas.handlePointerMove(40, 10, pointerEvent("rotation"))

    const a = canvas.getElements().get("a")!
    expect(a.rotation).toBe(90)
    expect(a.x).toBeCloseTo(20)
    expect(a.y).toBeCloseTo(-20)
    expect(canvas.getSelectedIds()).toEqual(new Set([group.id]))
  })
})

describe("group lifecycle and styles", () => {
  it("deleting a selected group removes its whole subtree", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setSelectedIds(new Set(["outer"]))

    canvas.deleteSelected()

    expect(canvas.getElements().size).toBe(0)
    expect(canvas.getSelectedIds().size).toBe(0)
  })

  it("deleting a child prunes the group and removes it when empty", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set(["a"]))

    canvas.deleteSelected()

    expect(canvas.getElements().has("a")).toBe(false)
    expect(groupElement(canvas, "outer").children).toEqual(["b"])
    expect(groupElement(canvas, "outer").x).toBe(40)

    canvas.setSelectedIds(new Set(["b"]))
    canvas.deleteSelected()

    expect(canvas.getElements().has("outer")).toBe(false)
    expect(canvas.getGroupContext()).toBeNull()
  })

  it("prunes excluded group children from serialized documents", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])

    const doc = canvas.toDocument({ exclude: (element) => element.id === "a" })
    const serializedGroup = doc.elements.find(
      (element) => element.type === "group",
    ) as GroupElement

    expect(doc.elements.some((element) => element.id === "a")).toBe(false)
    expect(serializedGroup.children).toEqual(["b"])
    expect(serializedGroup.x).toBe(40)
  })

  it("stacks a group as a unit with setZIndex", () => {
    const a = makeRect("a", 0, 0, 20, 20, 1)
    const b = makeRect("b", 40, 0, 20, 20, 3)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])

    canvas.setZIndex("outer", 10)

    expect(canvas.getElements().get("a")!.zIndex).toBe(8)
    expect(canvas.getElements().get("b")!.zIndex).toBe(10)
    expect(groupElement(canvas, "outer").zIndex).toBe(10)
  })

  it("applies style changes to every descendant", () => {
    const a = makeRect("a", 0, 0)
    const b = makeRect("b", 40, 0)
    const outer = makeGroup("outer", ["a", "b"])
    const canvas = setup([a, b, outer])
    canvas.setSelectedIds(new Set(["outer"]))

    canvas.setStyle({ strokeColor: "#f00", strokeWidth: 3 })

    expect(canvas.getElements().get("a")).toMatchObject({
      strokeColor: "#f00",
      strokeWidth: 3,
    })
    expect(canvas.getElements().get("b")).toMatchObject({
      strokeColor: "#f00",
      strokeWidth: 3,
    })
    expect(canvas.getStyle()).toMatchObject({
      strokeColor: "#f00",
      strokeWidth: 3,
    })
  })

  it("inherits hidden and locked flags from group ancestors", () => {
    const a = makeRect("a", 0, 0)
    const hidden = makeGroup("hidden", ["a"], { visible: false })
    const hiddenCanvas = setup([a, hidden])

    expect(
      getElementAtPoint(hiddenCanvas.getElements(), { x: 10, y: 10 }),
    ).toBeNull()
    expect(getElementsBounds(hiddenCanvas.getElements())).toBeNull()
    hiddenCanvas.selectAll()
    expect(hiddenCanvas.getSelectedIds().size).toBe(0)

    const b = makeRect("b", 0, 0)
    const locked = makeGroup("locked", ["b"], { locked: true })
    const lockedCanvas = setup([b, locked])

    expect(
      getElementAtPoint(lockedCanvas.getElements(), { x: 10, y: 10 }),
    ).toBeNull()
    lockedCanvas.selectAll()
    expect(lockedCanvas.getSelectedIds().size).toBe(0)
  })
})

describe("eraser and arrows", () => {
  it("erases the outermost group when touching a nested child", () => {
    const a = makeRect("a", 0, 0)
    const inner = makeGroup("inner", ["a"])
    const outer = makeGroup("outer", ["inner"])
    const canvas = setup([a, inner, outer])
    canvas.setActiveTool("eraser")

    canvas.handlePointerDown(10, 10, pointerEvent())

    expect(canvas.getElements().size).toBe(0)
  })

  it("keeps an arrow bound to a child while the group moves", () => {
    const a = makeRect("a", 0, 0, 100, 100)
    const outer = makeGroup("outer", ["a"])
    const arrow: ArrowElement = createArrow({
      endBinding: { elementId: "a" },
      endX: 150,
      endY: 50,
      height: 1,
      locked: false,
      rotation: 0,
      startBinding: null,
      startX: 250,
      startY: 50,
      strokeColor: "#000",
      strokeWidth: 1,
      visible: true,
      width: 100,
      x: 150,
      y: 50,
      zIndex: 2,
    })
    const canvas = setup([a, outer, arrow])
    canvas.setSelectedIds(new Set(["outer"]))

    canvas.handlePointerDown(50, 50, pointerEvent())
    canvas.handlePointerMove(70, 50, pointerEvent())

    const movedArrow = canvas.getElements().get(arrow.id) as ArrowElement
    expect(movedArrow.endBinding).toEqual({ elementId: "a" })
  })

  it("binds new arrows to child shapes rather than group bounds", () => {
    const a = makeRect("a", 0, 0, 100, 100)
    const outer = makeGroup("outer", ["a"])
    const canvas = setup([a, outer])

    const target = findBindingTarget(canvas.getElements(), { x: 50, y: 50 }, 0)

    expect(target?.id).toBe("a")
  })

  it("keeps existing group bindings valid", () => {
    const a = makeRect("a", 0, 0, 100, 100)
    const outer = makeGroup("outer", ["a"])
    const arrow: ArrowElement = createArrow({
      endBinding: { elementId: "outer" },
      endX: 200,
      endY: 50,
      height: 1,
      locked: false,
      rotation: 0,
      startBinding: null,
      startX: 100,
      startY: 50,
      strokeColor: "#000",
      strokeWidth: 1,
      visible: true,
      width: 100,
      x: 100,
      y: 50,
      zIndex: 2,
    })
    const elements = new Map<CanvasElement["id"], CanvasElement>([
      [a.id, a],
      [outer.id, outer],
      [arrow.id, arrow],
    ])

    expect(resolveArrowElement(arrow, elements).endBinding?.elementId).toBe(
      "outer",
    )
  })
})

describe("group DOM behavior", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
      },
    )
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  function mount(elements: CanvasElement[] = []): {
    canvas: AdrawCanvas
    svg: SVGSVGElement
  } {
    const canvas = new AdrawCanvas({ container })
    canvas.setCanvasSize(800, 600)
    if (elements.length > 0) {
      canvas.addElement(elements, { history: false })
    }
    return {
      canvas,
      svg: container.querySelector("svg")!,
    }
  }

  it("draws a context outline only while a group is entered", () => {
    const a = makeRect("a", 0, 0)
    const outer = makeGroup("outer", ["a"])
    const { canvas } = mount([a, outer])

    canvas.setGroupContext("outer")
    canvas.setSelectedIds(new Set(["a"]))
    canvas.render()

    const outline = container.querySelector(".adraw-group-context-box")
    expect(outline).not.toBeNull()
    expect(outline?.getAttribute("width")).toBe("20")

    canvas.clearSelection()
    canvas.render()

    expect(container.querySelector(".adraw-group-context-box")).toBeNull()
  })

  it("hides descendants of a hidden group in the DOM and export", async () => {
    const a = makeRect("a", 0, 0)
    const outer = makeGroup("outer", ["a"], { visible: false })
    const { canvas } = mount([a, outer])

    expect(container.querySelector('g[id="a"]')).toBeNull()
    const blob = await canvas.toImage({ format: "svg" })
    expect(await blob.text()).not.toContain('id="a"')
    canvas.destroy()
  })

  it("double-click enters the group, then edits a direct child's label", () => {
    const a = makeRect("a", 0, 0, 20, 20)
    const b = makeRect("b", 40, 0, 20, 20)
    const outer = makeGroup("outer", ["a", "b"])
    const { canvas, svg } = mount([a, b, outer])

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 410,
        clientY: 310,
      }),
    )

    expect(canvas.getSelectedIds()).toEqual(new Set(["a"]))
    expect(canvas.getGroupContext()).toBe("outer")

    svg.dispatchEvent(
      new MouseEvent("dblclick", {
        bubbles: true,
        clientX: 410,
        clientY: 310,
      }),
    )

    expect(document.querySelector("textarea")).not.toBeNull()
    const label = [...canvas.getElements().values()].find(
      (element) => element.type === "text" && element.containerId === "a",
    )
    expect(label).toBeDefined()
    expect(groupElement(canvas, "outer").children).toContain(label!.id)
    expect(canvas.getGroupContext()).toBe("outer")

    canvas.destroy()
  })
})
