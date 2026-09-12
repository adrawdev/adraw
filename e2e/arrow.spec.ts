import { expect, test, type Page } from "@playwright/test"

import { drag, openCanvas, pickTool } from "./helpers"

interface ArrowState {
  arrowEndBinding: string | null
  arrowEndX: number
  arrowEndY: number
  rectId: string | null
  rectX: number
  rectY: number
}

function readArrowState(page: Page): Promise<ArrowState> {
  return page.evaluate<ArrowState>(() => {
    const canvas = (window as any).adraw
    const elements = [...canvas.getElements().values()]
    const arrow = elements.find((element: any) => element.type === "arrow")
    const rect = elements.find((element: any) => element.type === "rectangle")
    return {
      arrowEndBinding: arrow?.endBinding?.elementId ?? null,
      arrowEndX: arrow?.endX ?? 0,
      arrowEndY: arrow?.endY ?? 0,
      rectId: rect?.id ?? null,
      rectX: rect?.x ?? 0,
      rectY: rect?.y ?? 0,
    }
  })
}

test.describe("arrow tool", () => {
  test("binds the endpoint to a shape it is dropped on", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 150, y: 150 }, { x: 350, y: 300 })

    await pickTool(page, "arrow")
    await drag(page, svg, { x: 600, y: 225 }, { x: 250, y: 225 })

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(2)
    const state = await readArrowState(page)
    expect(state.rectId).toBeTruthy()
    expect(state.arrowEndBinding).toBe(state.rectId)
  })

  test("moves the bound endpoint when the target moves", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 150, y: 150 }, { x: 350, y: 300 })

    await pickTool(page, "arrow")
    await drag(page, svg, { x: 600, y: 225 }, { x: 250, y: 225 })

    const before = await readArrowState(page)

    // Select and move the rectangle; the arrow is not selected, so its binding
    // must keep the endpoint glued to the target.
    await pickTool(page, "select")
    await drag(page, svg, { x: 250, y: 225 }, { x: 300, y: 275 })

    const after = await readArrowState(page)
    expect(after.rectX - before.rectX).toBeCloseTo(50, 0)
    expect(after.rectY - before.rectY).toBeCloseTo(50, 0)
    expect(after.arrowEndBinding).toBe(before.rectId)
    expect(after.arrowEndX).toBeGreaterThan(before.arrowEndX + 30)
  })
})
