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
    await page.keyboard.press("ControlOrMeta+a")
    expect(await selectedCount(page)).toBe(2)

    // Start in the gap between the shapes, but inside their combined bounds.
    await drag(page, svg, { x: 240, y: 140 }, { x: 270, y: 170 })

    const positions = await page.evaluate(() =>
      [...(window as any).adraw.getElements().values()]
        .map((element: any) => ({ x: element.x, y: element.y }))
        .toSorted((a, b) => a.x - b.x),
    )
    expect(positions).toHaveLength(2)
    expect(positions[0].x).toBeCloseTo(130, 1)
    expect(positions[0].y).toBeCloseTo(130, 1)
    expect(positions[1].x).toBeCloseTo(330, 1)
    expect(positions[1].y).toBeCloseTo(130, 1)
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

    // Release the pointer past the container's right edge — and, when the
    // container reaches the viewport edge, at the very edge of the window.
    const from = { x: center.x, y: center.y }
    const to = {
      x: Math.max(box.width + 40, viewport.width - box.x - 1),
      y: center.y,
    }
    const before = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const element = [...canvas.getElements().values()][0]
      return { x: element.x, y: element.y }
    })
    await drag(page, svg, from, to)

    // The drag delta must apply in full — pointer capture keeps move/up
    // events flowing outside the container, so the shape is not clipped at
    // its edge.
    const after = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const element = [...canvas.getElements().values()][0]
      return { x: element.x, y: element.y }
    })
    expect(after.x).toBeCloseTo(before.x + (to.x - from.x), 1)
    expect(after.y).toBeCloseTo(before.y, 1)
  })
})
