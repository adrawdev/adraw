import { expect, test } from "@playwright/test"

import { drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("eraser", () => {
  test("dragging the eraser over a shape deletes it", async ({ page }) => {
    const svg = await openCanvas(page)

    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 150, y: 150 }, { x: 320, y: 300 })
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)

    await pickTool(page, "eraser")
    // Drag straight through the middle of the rectangle.
    await drag(page, svg, { x: 160, y: 225 }, { x: 310, y: 225 }, 12)

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(0)
    const state = await snapshot(page)
    expect(state.elementCount).toBe(0)
  })

  test("leaves other shapes untouched", async ({ page }) => {
    const svg = await openCanvas(page)

    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 100, y: 150 }, { x: 200, y: 260 })
    // Drawing auto-switches to the select tool, so re-pick before the next.
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 300, y: 150 }, { x: 400, y: 260 })
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(2)

    await pickTool(page, "eraser")
    // Erase only the first rectangle.
    await drag(page, svg, { x: 110, y: 205 }, { x: 190, y: 205 }, 8)

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)
  })
})
