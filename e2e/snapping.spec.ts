import { expect, type Locator, type Page, test } from "@playwright/test"

import { drag, openCanvas, pickTool, selectedCount } from "./helpers"

/** Draw two rectangles and select the right one. */
async function setup(page: Page, svg: Locator) {
  await pickTool(page, "rectangle")
  await drag(page, svg, { x: 150, y: 150 }, { x: 250, y: 250 })
  await pickTool(page, "rectangle")
  await drag(page, svg, { x: 400, y: 150 }, { x: 500, y: 250 })

  const box = (await svg.boundingBox())!
  await page.mouse.click(box.x + 450, box.y + 200)
  expect(await selectedCount(page)).toBe(1)
  return box
}

/** Gap between the first rectangle's right edge and the second's left edge. */
function edgeGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const [first, second] = [...(window as any).adraw.getElements().values()]
    return second.x - (first.x + first.width)
  })
}

test.describe("element snapping", () => {
  test("snaps the dragged element to a neighbour while Ctrl is held", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    const box = await setup(page, svg)

    // Drag the second rectangle left so its left edge lands 3px past the
    // first rectangle's right edge (within the 5px threshold).
    await page.mouse.move(box.x + 450, box.y + 200)
    await page.keyboard.down("Control")
    await page.mouse.down()
    await page.mouse.move(box.x + 303, box.y + 200, { steps: 10 })

    // Both axes align here: B's left edge with A's right edge, and B's
    // vertical center with A's.
    expect(await page.locator(".adraw-snap-guide").count()).toBe(2)
    await page.mouse.up()
    await page.keyboard.up("Control")

    expect(await edgeGap(page)).toBeCloseTo(0, 0)
    await expect(page.locator(".adraw-snap-guide")).toHaveCount(0)
  })

  test("does not snap without the modifier", async ({ page }) => {
    const svg = await openCanvas(page)
    await setup(page, svg)

    await drag(page, svg, { x: 450, y: 200 }, { x: 303, y: 200 })

    expect(await edgeGap(page)).toBeCloseTo(3, 0)
  })
})
