import { describe, expect, it } from "vitest"

import { planStateRender } from "../dom/render/plan"
import type { StateChangeKind } from "../engine/state-notifier"

function plan(...kinds: StateChangeKind[]) {
  return planStateRender(new Set(kinds))
}

describe("DOM render plan", () => {
  it("renders a full frame once for viewport and overlay changes", () => {
    expect(plan("viewport")).toEqual(["renderAll"])
    expect(plan("viewport", "overlay")).toEqual(["renderAll"])
  })

  it("reconciles elements once and skips the selection-only pass", () => {
    expect(plan("elements", "selection")).toEqual([
      "reconcileElements",
      "renderGuides",
      "renderTransformOverlay",
    ])
  })

  it("renders selected nodes when only selection changes", () => {
    expect(plan("selection")).toEqual([
      "renderSelectElements",
      "renderTransformOverlay",
    ])
  })

  it("updates selected nodes before a simultaneous full render", () => {
    expect(plan("selection", "viewport")).toEqual([
      "renderSelectElements",
      "renderAll",
    ])
  })

  it("reconciles elements before a simultaneous full render", () => {
    expect(plan("elements", "overlay")).toEqual([
      "reconcileElements",
      "renderAll",
    ])
  })

  it("renders tool chrome once for tool changes", () => {
    expect(plan("tool")).toEqual([
      "renderGuides",
      "renderTransformOverlay",
      "updateCursor",
    ])
    expect(plan("elements", "selection", "tool")).toEqual([
      "reconcileElements",
      "renderGuides",
      "renderTransformOverlay",
      "updateCursor",
    ])
  })

  it("does no DOM work for store-only changes", () => {
    expect(plan("style", "history", "snapping", "toolLock", "mount")).toEqual(
      [],
    )
  })
})
