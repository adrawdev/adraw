import { expect, test } from "@playwright/test"

import { clickAction, drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("history", () => {
  test("undo removes the last shape, redo restores it", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 150, y: 150 }, { x: 300, y: 260 })

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)

    await clickAction(page, "undo")
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(0)
    const afterUndo = await snapshot(page)
    expect(afterUndo.canRedo).toBe(true)

    await clickAction(page, "redo")
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)
  })

  test("undo/redo work via keyboard shortcuts", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 240, y: 240 })
    // Drawing auto-switches to the select tool, so re-pick before the next.
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 260, y: 120 }, { x: 380, y: 240 })

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(2)

    await page.keyboard.press("ControlOrMeta+z")
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)

    await page.keyboard.press("ControlOrMeta+z")
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(0)

    await page.keyboard.press("ControlOrMeta+Shift+z")
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)
  })

  test("undo is a no-op on a fresh canvas", async ({ page }) => {
    await openCanvas(page)

    const initial = await snapshot(page)
    expect(initial.canUndo).toBe(false)
    await clickAction(page, "undo")
    const afterUndo = await snapshot(page)
    expect(afterUndo.elementCount).toBe(0)
  })
})
