// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AdrawCanvas } from "../canvas"
import { createRectangle, createText } from "../elements"
import { subscribeState, type StateChangeKind } from "../engine/state-notifier"
import { AdrawStore, type AdrawSnapshot } from "../store"

function makeRect(id: string, zIndex = 0) {
  return createRectangle({
    cornerRadius: 0,
    height: 10,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#111",
    strokeWidth: 2,
    visible: true,
    width: 10,
    x: 0,
    y: 0,
    zIndex,
  })
}

function makeText(id = "text") {
  return createText({
    fontSize: 20,
    height: 24,
    id,
    locked: false,
    rotation: 0,
    strokeColor: "#111",
    text: "Hello",
    visible: true,
    width: 60,
    x: 0,
    y: 0,
    zIndex: 0,
  })
}

function addRect(canvas: AdrawCanvas, id = "a", zIndex = 0) {
  canvas.addElement(makeRect(id, zIndex), { history: false })
}

function addSelectedRect(canvas: AdrawCanvas) {
  addRect(canvas)
  canvas.selectAll()
}

function measureHello(width: number, height: number) {
  return () => ({ height, lines: ["Hello"], width })
}

interface OperationCase {
  expectedKinds: StateChangeKind[]
  expectedSnapshots: number
  name: string
  run: (canvas: AdrawCanvas) => void
  setup?: (canvas: AdrawCanvas) => void
}

const operations: OperationCase[] = [
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "setCanvasSize",
    run: (canvas) => canvas.setCanvasSize(800, 600),
  },
  {
    expectedKinds: ["selection", "tool"],
    expectedSnapshots: 1,
    name: "setActiveTool",
    run: (canvas) => canvas.setActiveTool("rectangle"),
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "setViewport",
    run: (canvas) => canvas.setViewport({ x: 10, y: 10, zoom: 2 }),
  },
  {
    expectedKinds: ["elements", "history", "selection", "tool"],
    expectedSnapshots: 1,
    name: "insertMedia",
    run: (canvas) => {
      canvas.insertMedia({
        mimeType: "image/png",
        naturalHeight: 10,
        naturalWidth: 10,
        src: "data:image/png;base64,",
      })
    },
    setup: (canvas) => canvas.setActiveTool("line"),
  },
  {
    expectedKinds: ["elements", "history"],
    expectedSnapshots: 1,
    name: "addElement",
    run: (canvas) => canvas.addElement(makeRect("a")),
  },
  {
    expectedKinds: ["elements", "history", "selection"],
    expectedSnapshots: 1,
    name: "loadDocument",
    run: (canvas) => {
      canvas.loadDocument({ elements: [makeRect("a")], version: 1 })
    },
  },
  {
    expectedKinds: ["elements", "history", "selection"],
    expectedSnapshots: 1,
    name: "setElements",
    run: (canvas) => canvas.setElements([makeRect("a")]),
  },
  {
    expectedKinds: ["elements", "selection"],
    expectedSnapshots: 0,
    name: "setElements no-op",
    run: (canvas) => {
      canvas.setElements(new Map(canvas.getElements()), { history: false })
    },
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: ["elements", "history"],
    expectedSnapshots: 1,
    name: "bringToFront",
    run: (canvas) => canvas.bringToFront("a"),
    setup: (canvas) => {
      addRect(canvas, "a", 0)
      addRect(canvas, "b", 1)
    },
  },
  {
    expectedKinds: ["elements", "history"],
    expectedSnapshots: 1,
    name: "sendToBack",
    run: (canvas) => canvas.sendToBack("b"),
    setup: (canvas) => {
      addRect(canvas, "a", 0)
      addRect(canvas, "b", 1)
    },
  },
  {
    expectedKinds: ["elements", "history"],
    expectedSnapshots: 1,
    name: "setZIndex",
    run: (canvas) => canvas.setZIndex("a", 5),
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: ["snapping"],
    expectedSnapshots: 1,
    name: "setSnappingConfig",
    run: (canvas) => canvas.setSnappingConfig({ threshold: 12 }),
  },
  {
    expectedKinds: ["snapping"],
    expectedSnapshots: 1,
    name: "setIsSnapMode",
    run: (canvas) => canvas.setIsSnapMode(true),
  },
  {
    expectedKinds: ["elements", "selection"],
    expectedSnapshots: 1,
    name: "setTextMeasurer",
    run: (canvas) => canvas.setTextMeasurer(measureHello(100, 40)),
    setup: (canvas) => canvas.addElement(makeText(), { history: false }),
  },
  {
    expectedKinds: ["elements", "selection"],
    expectedSnapshots: 1,
    name: "refreshTextMetrics",
    run: (canvas) => {
      refreshText = true
      canvas.refreshTextMetrics()
    },
    setup: (canvas) => {
      refreshText = false
      canvas.addElement(makeText(), { history: false })
      canvas.setTextMeasurer(() =>
        refreshText
          ? { height: 40, lines: ["Hello"], width: 100 }
          : { height: 24, lines: ["Hello"], width: 60 },
      )
    },
  },
  {
    expectedKinds: ["elements", "selection"],
    expectedSnapshots: 1,
    name: "setAdapterTextMeasurer",
    run: (canvas) => canvas.setAdapterTextMeasurer(measureHello(100, 40)),
    setup: (canvas) => canvas.addElement(makeText(), { history: false }),
  },
  {
    expectedKinds: ["elements", "selection"],
    expectedSnapshots: 1,
    name: "resetTextMeasurer",
    run: (canvas) => canvas.resetTextMeasurer(),
    setup: (canvas) => {
      canvas.addElement(makeText(), { history: false })
      canvas.setAdapterTextMeasurer(measureHello(100, 40))
    },
  },
  {
    expectedKinds: ["elements", "style"],
    expectedSnapshots: 1,
    name: "setStyle",
    run: (canvas) => canvas.setStyle({ strokeColor: "#f00" }),
    setup: addSelectedRect,
  },
  {
    expectedKinds: ["overlay"],
    expectedSnapshots: 1,
    name: "setHideOverlayWhileTransforming",
    run: (canvas) => canvas.setHideOverlayWhileTransforming(true),
  },
  {
    expectedKinds: ["toolLock"],
    expectedSnapshots: 1,
    name: "setIsToolLocked",
    run: (canvas) => canvas.setIsToolLocked(true),
  },
  {
    expectedKinds: ["elements", "history", "selection"],
    expectedSnapshots: 1,
    name: "undo",
    run: (canvas) => canvas.undo(),
    setup: (canvas) => canvas.addElement(makeRect("a")),
  },
  {
    expectedKinds: ["elements", "history", "selection"],
    expectedSnapshots: 1,
    name: "redo",
    run: (canvas) => canvas.redo(),
    setup: (canvas) => {
      canvas.addElement(makeRect("a"))
      canvas.undo()
    },
  },
  {
    expectedKinds: ["history"],
    expectedSnapshots: 1,
    name: "pushHistory",
    run: (canvas) => canvas.pushHistory(),
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: ["history"],
    expectedSnapshots: 1,
    name: "clearHistory",
    run: (canvas) => canvas.clearHistory(),
    setup: (canvas) => canvas.addElement(makeRect("a")),
  },
  {
    expectedKinds: ["elements", "history"],
    expectedSnapshots: 1,
    name: "withoutHistory",
    run: (canvas) => {
      canvas.withoutHistory(() => {
        canvas.addElement(makeRect("a"))
      })
    },
  },
  {
    expectedKinds: ["selection", "tool"],
    expectedSnapshots: 1,
    name: "handleKeyDown",
    run: (canvas) => {
      canvas.handleKeyDown(new KeyboardEvent("keydown", { key: "r" }))
    },
  },
  {
    expectedKinds: ["selection"],
    expectedSnapshots: 1,
    name: "selectAll",
    run: (canvas) => canvas.selectAll(),
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: ["selection"],
    expectedSnapshots: 1,
    name: "clearSelection",
    run: (canvas) => canvas.clearSelection(),
    setup: addSelectedRect,
  },
  {
    expectedKinds: ["elements", "history", "selection"],
    expectedSnapshots: 1,
    name: "deleteSelected",
    run: (canvas) => canvas.deleteSelected(),
    setup: addSelectedRect,
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "copy",
    run: (canvas) => canvas.copy(),
    setup: addSelectedRect,
  },
  {
    expectedKinds: ["elements", "history", "selection"],
    expectedSnapshots: 1,
    name: "cut",
    run: (canvas) => canvas.cut(),
    setup: addSelectedRect,
  },
  {
    expectedKinds: ["elements", "history", "selection", "tool"],
    expectedSnapshots: 1,
    name: "paste",
    run: (canvas) => canvas.paste(),
    setup: (canvas) => {
      addSelectedRect(canvas)
      canvas.copy()
      canvas.setActiveTool("line")
    },
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "serializeClipboard",
    run: (canvas) => canvas.serializeClipboard(),
    setup: (canvas) => {
      addSelectedRect(canvas)
      canvas.copy()
    },
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "deserializeClipboard",
    run: (canvas) => canvas.deserializeClipboard("{}"),
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "zoomIn",
    run: (canvas) => canvas.zoomIn(),
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "zoomOut",
    run: (canvas) => canvas.zoomOut(),
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "resetZoom",
    run: (canvas) => canvas.resetZoom(),
    setup: (canvas) => canvas.setViewport({ x: 10, y: 20, zoom: 2 }),
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "zoomToFit",
    run: (canvas) => canvas.zoomToFit(),
    setup: (canvas) => {
      canvas.setCanvasSize(800, 600)
      addRect(canvas)
    },
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "handleWheel",
    run: (canvas) => {
      canvas.handleWheel(new WheelEvent("wheel", { deltaY: 40 }), 400, 300)
    },
  },
  {
    expectedKinds: ["elements"],
    expectedSnapshots: 1,
    name: "commitScene",
    run: (canvas) => {
      canvas.commitScene((draft) => {
        const rect = makeRect("a")
        draft.elements.set(rect.id, rect)
      })
    },
  },
  {
    expectedKinds: ["selection"],
    expectedSnapshots: 1,
    name: "setSelectedIds",
    run: (canvas) => canvas.setSelectedIds(new Set(["a"])),
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: ["tool"],
    expectedSnapshots: 1,
    name: "ToolContext.finishCreation",
    run: (canvas) => canvas.getToolContext().finishCreation(),
    setup: (canvas) => canvas.setActiveTool("rectangle"),
  },
  {
    expectedKinds: ["history"],
    expectedSnapshots: 1,
    name: "ToolContext.pushHistory",
    run: (canvas) => canvas.getToolContext().pushHistory(),
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: ["elements"],
    expectedSnapshots: 1,
    name: "ToolContext.setElements",
    run: (canvas) => {
      canvas.getToolContext().setElements(new Map([["a", makeRect("a")]]))
    },
  },
  {
    expectedKinds: ["selection"],
    expectedSnapshots: 1,
    name: "ToolContext.setSelectedIds",
    run: (canvas) => canvas.getToolContext().setSelectedIds(new Set(["a"])),
    setup: (canvas) => addRect(canvas),
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "ToolContext.setSnapGuides",
    run: (canvas) => canvas.getToolContext().setSnapGuides([]),
  },
  {
    expectedKinds: ["viewport"],
    expectedSnapshots: 1,
    name: "ToolContext.setViewport",
    run: (canvas) =>
      canvas.getToolContext().setViewport({ x: 5, y: 6, zoom: 2 }),
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "setSnapGuides",
    run: (canvas) => canvas.setSnapGuides([]),
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "setPointerPoint",
    run: (canvas) => canvas.setPointerPoint({ x: 1, y: 2 }),
  },
  {
    expectedKinds: [],
    expectedSnapshots: 0,
    name: "render",
    run: (canvas) => canvas.render(),
  },
]

let refreshText = false

beforeEach(() => {
  refreshText = false
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect(): void {}
      observe(): void {}
    },
  )
})

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe.each(operations)("$name", (operation) => {
  it(`publishes ${operation.expectedSnapshots} snapshot(s)`, () => {
    const canvas = new AdrawCanvas()
    operation.setup?.(canvas)
    const changes: StateChangeKind[][] = []
    subscribeState(canvas, (change) => {
      changes.push([...change].toSorted())
    })
    const store = new AdrawStore(canvas)
    const snapshots: AdrawSnapshot[] = []
    store.subscribe(() => {
      snapshots.push(store.getSnapshot())
    })

    operation.run(canvas)

    expect(changes).toEqual(
      operation.expectedKinds.length > 0
        ? [operation.expectedKinds.toSorted()]
        : [],
    )
    expect(snapshots).toHaveLength(operation.expectedSnapshots)
    for (const snapshot of snapshots) {
      for (const id of snapshot.selectedIds) {
        expect(snapshot.elements.has(id)).toBe(true)
      }
      expect(snapshot.selectedElements.map((element) => element.id)).toEqual([
        ...snapshot.selectedIds,
      ])
    }
    store.dispose()
  })
})

describe("mount lifecycle publication", () => {
  it("publishes mount and destroy once each", () => {
    const canvas = new AdrawCanvas()
    const store = new AdrawStore(canvas)
    const snapshots = []
    store.subscribe(() => snapshots.push(store.getSnapshot()))
    const container = document.createElement("div")
    document.body.appendChild(container)

    canvas.mount(container)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].isReady).toBe(true)

    canvas.destroy()
    expect(snapshots).toHaveLength(2)
    expect(snapshots[1].isReady).toBe(false)
    store.dispose()
  })
})
