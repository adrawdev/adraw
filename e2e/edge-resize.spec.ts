import { expect, type Locator, type Page, test } from "@playwright/test"

import { drag, openCanvas, pickTool, selectedCount } from "./helpers"

/** Bounds (width/height) of the single element on the canvas. */
function elementSize(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const canvas = (window as any).adraw
    const [element] = [...canvas.getElements().values()]
    return { height: element.height, width: element.width }
  })
}

/** Draw a rectangle and leave it selected, returning its screen-space bounds. */
async function drawAndSelect(page: Page, svg: Locator) {
  const from = { x: 150, y: 150 }
  const to = { x: 350, y: 300 }
  await pickTool(page, "rectangle")
  await drag(page, svg, from, to)

  await pickTool(page, "select")
  const box = (await svg.boundingBox())!
  const center = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  await page.mouse.click(box.x + center.x, box.y + center.y)
  expect(await selectedCount(page)).toBe(1)

  return { from, to }
}

test.describe("edge resize", () => {
  test("dragging the right edge changes width but not height", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    const { from, to } = await drawAndSelect(page, svg)
    const before = await elementSize(page)

    // Mid-point of the right edge, dragged 50px further right.
    const midY = (from.y + to.y) / 2
    await drag(page, svg, { x: to.x, y: midY }, { x: to.x + 50, y: midY })

    const after = await elementSize(page)
    expect(after.width).toBeCloseTo(before.width + 50, 0)
    expect(after.height).toBeCloseTo(before.height, 0)
  })

  test("dragging the bottom edge changes height but not width", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    const { from, to } = await drawAndSelect(page, svg)
    const before = await elementSize(page)

    // Mid-point of the bottom edge, dragged 60px further down.
    const midX = (from.x + to.x) / 2
    await drag(page, svg, { x: midX, y: to.y }, { x: midX, y: to.y + 60 })

    const after = await elementSize(page)
    expect(after.height).toBeCloseTo(before.height + 60, 0)
    expect(after.width).toBeCloseTo(before.width, 0)
  })

  test("holding Shift constrains a corner resize to the original proportions", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    const { to } = await drawAndSelect(page, svg)
    const before = await elementSize(page)

    // The horizontal drag is dominant, so the resized height follows the
    // original width/height ratio instead of the pointer's exact y position.
    await page.keyboard.down("Shift")
    await drag(page, svg, { x: to.x, y: to.y }, { x: to.x + 100, y: to.y + 20 })
    await page.keyboard.up("Shift")

    const after = await elementSize(page)
    expect(after.width).toBeCloseTo(before.width + 100, 0)
    expect(after.height).toBeCloseTo(
      (before.width + 100) * (before.height / before.width),
      0,
    )
  })

  test("the transform overlay renders four corner handles", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await drawAndSelect(page, svg)

    // The edge-center handles were removed; only the four corners remain.
    await expect(
      page.locator(
        '.adraw-transform-overlay .adraw-resize-handle[data-anchor="top-left"], ' +
          '.adraw-transform-overlay .adraw-resize-handle[data-anchor="top-right"], ' +
          '.adraw-transform-overlay .adraw-resize-handle[data-anchor="bottom-left"], ' +
          '.adraw-transform-overlay .adraw-resize-handle[data-anchor="bottom-right"]',
      ),
    ).toHaveCount(4)
  })
})
