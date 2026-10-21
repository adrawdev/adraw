import { expect, type Locator, type Page, test } from "@playwright/test"

import { drag, openCanvas, pickTool, selectedCount } from "./helpers"

/** Draw a rectangle and return the click point at its center. */
async function drawRect(
  page: Page,
  svg: Locator,
  from = { x: 150, y: 150 },
  to = { x: 350, y: 300 },
) {
  await pickTool(page, "rectangle")
  await drag(page, svg, from, to)
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

/** Read element positions from the exposed canvas, sorted by x. */
function elementPositions(page: Page): Promise<{ x: number; y: number }[]> {
  return page.evaluate(() =>
    [...(window as any).adraw.getElements().values()]
      .map((element: any) => ({ x: element.x, y: element.y }))
      .toSorted((a, b) => a.x - b.x),
  )
}

test.describe("selection", () => {
  test("clicking a shape with the select tool selects it", async ({ page }) => {
    const svg = await openCanvas(page)
    const center = await drawRect(page, svg)

    await pickTool(page, "select")
    const box = (await svg.boundingBox())!
    await page.mouse.click(box.x + center.x, box.y + center.y)

    expect(await selectedCount(page)).toBe(1)
    await expect(
      page.locator(".adraw-elements-group .adraw-selected"),
    ).toHaveCount(1)
    // The transform overlay shows resize handles for the selection.
    await expect(
      page.locator(".adraw-transform-overlay .adraw-resize-handle").first(),
    ).toBeVisible()
  })

  test("clicking empty canvas clears the selection", async ({ page }) => {
    const svg = await openCanvas(page)
    const center = await drawRect(page, svg)
    await pickTool(page, "select")
    const box = (await svg.boundingBox())!

    await page.mouse.click(box.x + center.x, box.y + center.y)
    expect(await selectedCount(page)).toBe(1)

    await page.mouse.click(box.x + 40, box.y + 40)
    expect(await selectedCount(page)).toBe(0)
    await expect(
      page.locator(".adraw-transform-overlay .adraw-resize-handle"),
    ).toHaveCount(0)
  })

  test("Delete removes the selected shape", async ({ page }) => {
    const svg = await openCanvas(page)
    const center = await drawRect(page, svg)
    await pickTool(page, "select")
    const box = (await svg.boundingBox())!
    await page.mouse.click(box.x + center.x, box.y + center.y)
    // Wait for the selection to register before pressing Delete.
    expect(await selectedCount(page)).toBe(1)

    await page.keyboard.press("Delete")

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(0)
    expect(await selectedCount(page)).toBe(0)
  })

  test("Ctrl+A selects all shapes", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 100, y: 100 }, { x: 200, y: 200 })
    // Drawing auto-switches to the select tool, so re-pick before the next.
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 260, y: 120 }, { x: 380, y: 240 })

    await pickTool(page, "select")
    await svg.focus()
    await page.keyboard.press("ControlOrMeta+a")

    expect(await selectedCount(page)).toBe(2)
    await expect(
      page.locator(".adraw-elements-group .adraw-selected"),
    ).toHaveCount(2)
  })

  test("dragging inside a multi-selection box moves all selected shapes", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 100, y: 100 }, { x: 180, y: 180 })
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 300, y: 100 }, { x: 380, y: 180 })

    await pickTool(page, "select")
    await svg.focus()
    await page.keyboard.press("ControlOrMeta+a")
    expect(await selectedCount(page)).toBe(2)

    // Start in the gap between the shapes, but inside their combined bounds.
    const before = await elementPositions(page)
    await drag(page, svg, { x: 240, y: 140 }, { x: 270, y: 170 })

    const positions = await elementPositions(page)
    expect(positions).toHaveLength(2)
    for (let index = 0; index < positions.length; index += 1) {
      expect(positions[index].x).toBeCloseTo(before[index].x + 30, 1)
      expect(positions[index].y).toBeCloseTo(before[index].y + 30, 1)
    }
  })

  test("Escape clears the selection", async ({ page }) => {
    const svg = await openCanvas(page)
    const center = await drawRect(page, svg)
    await pickTool(page, "select")
    const box = (await svg.boundingBox())!
    await page.mouse.click(box.x + center.x, box.y + center.y)
    expect(await selectedCount(page)).toBe(1)

    await page.keyboard.press("Escape")
    expect(await selectedCount(page)).toBe(0)
  })

  test("dragging a shape continues past the container edge", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    const center = await drawRect(page, svg)
    await pickTool(page, "select")
    const box = (await svg.boundingBox())!
    const viewport = page.viewportSize()!

    // Leave the container through its top edge (into the toolbar) while also
    // moving to the right edge of the window. Pointer capture must keep
    // move/up events flowing to the canvas, so the delta applies in full
    // instead of being clipped at the container's edge.
    const from = { x: center.x, y: center.y }
    const to = {
      x: Math.min(box.width + 40, viewport.width - box.x - 1),
      y: -Math.min(30, box.y - 1),
    }
    const [before] = await elementPositions(page)
    await drag(page, svg, from, to)

    const [after] = await elementPositions(page)
    expect(after.x).toBeCloseTo(before.x + (to.x - from.x), 1)
    expect(after.y).toBeCloseTo(before.y + (to.y - from.y), 1)
  })
})
