import { expect, test, type Page } from "@playwright/test"

import { drag, openCanvas, pickTool, snapshot } from "./helpers"

async function drawTwoRectangles(page: Page) {
  const svg = await openCanvas(page)
  await pickTool(page, "rectangle")
  await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 220 })
  await pickTool(page, "rectangle")
  await drag(page, svg, { x: 260, y: 120 }, { x: 360, y: 220 })
  return svg
}

function selectedTypes(page: Page) {
  return page.evaluate<string[]>(() => {
    const canvas = (window as any).adraw
    return [...canvas.getSelectedIds()].map(
      (id: string) => canvas.getElements().get(id).type,
    )
  })
}

test.describe("groups", () => {
  test("groups and ungroups with keyboard shortcuts", async ({ page }) => {
    await drawTwoRectangles(page)

    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.press("ControlOrMeta+g")

    const grouped = await snapshot(page)
    expect(grouped.elementTypes).toContain("group")
    expect(grouped.selectedCount).toBe(1)

    await page.keyboard.press("ControlOrMeta+Shift+g")

    const ungrouped = await snapshot(page)
    expect(ungrouped.elementTypes).not.toContain("group")
    expect(ungrouped.selectedCount).toBe(2)
  })

  test("double-click enters a group and Escape steps out", async ({ page }) => {
    const svg = await drawTwoRectangles(page)
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }

    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.press("ControlOrMeta+g")

    await page.mouse.dblclick(box.x + 170, box.y + 170)

    expect(await selectedTypes(page)).toEqual(["rectangle"])
    await expect(page.locator(".adraw-group-context-box")).toHaveCount(1)

    await page.keyboard.press("Escape")

    expect(await selectedTypes(page)).toEqual(["group"])
    await expect(page.locator(".adraw-group-context-box")).toHaveCount(0)
  })
})
