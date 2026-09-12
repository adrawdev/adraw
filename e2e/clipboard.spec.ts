import { expect, test } from "@playwright/test"

import { clickAction, drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("clipboard", () => {
  test("toolbar copy and paste duplicate the selected element", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 200 })

    expect((await snapshot(page)).elementCount).toBe(1)

    await clickAction(page, "copy")
    await clickAction(page, "paste")

    const state = await snapshot(page)
    expect(state.elementCount).toBe(2)
    expect(state.selectedCount).toBe(1)
  })

  test("toolbar cut removes the selection and paste restores it", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 200 })

    await clickAction(page, "cut")
    expect((await snapshot(page)).elementCount).toBe(0)

    await clickAction(page, "paste")
    expect((await snapshot(page)).elementCount).toBe(1)
  })

  test("Ctrl+C / Ctrl+V duplicate the selection", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 200 })

    await page.keyboard.press("Control+c")
    await page.keyboard.press("Control+v")

    expect((await snapshot(page)).elementCount).toBe(2)
  })
})
