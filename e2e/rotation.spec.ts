import { expect, type Page, test } from "@playwright/test"

import { drag, openCanvas, pickTool, selectedCount } from "./helpers"

test.describe("rotation", () => {
  async function getHandleCenter(page: Page) {
    const handle = page.locator(
      ".adraw-transform-overlay .adraw-rotation-handle",
    )
    const box = await handle.boundingBox()
    if (!box) {
      throw new Error("rotation handle not visible")
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  function readElements(page: Page) {
    return page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].map((el: any) => ({
        id: el.id,
        rotation: el.rotation % 360,
        x: Math.round(el.x),
        y: Math.round(el.y),
      }))
    })
  }

  test("rotates two selected rectangles around the selection center", async ({
    page,
  }) => {
    const svg = await openCanvas(page)

    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 200, y: 200 }, { x: 400, y: 350 })
    // Drawing auto-switches to the select tool, so re-pick before the next.
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 450, y: 200 }, { x: 650, y: 350 })

    await pickTool(page, "select")
    await page.keyboard.press("ControlOrMeta+a")
    expect(await selectedCount(page)).toBe(2)

    const before = await readElements(page)

    // Drag the rotation handle to produce a rotation. The handle sits at
    // (bounds.cx, bounds.y - spacing/zoom); the selection center is at
    // (bounds.cx, bounds.cy). Drag by (r, r) where r = spacing + height/2
    // to rotate 90° in screen coordinates.
    const center = await getHandleCenter(page)
    const r = 105 // rotationHandleSpacing(30) + half-height(75)
    const endX = center.x + r
    const endY = center.y + r

    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 8 })
    await page.mouse.up()

    const after = await readElements(page)
    expect(after).toHaveLength(2)
    for (const el of after) {
      expect(el.rotation).toBeCloseTo(90, 0)
    }
    for (const el of after) {
      const b = before.find((x: any) => x.id === el.id)
      expect(b).toBeDefined()
      expect(el.x).not.toBe(b!.x)
      expect(el.y).not.toBe(b!.y)
    }
  })

  test("rotates a single rectangle in place", async ({ page }) => {
    const svg = await openCanvas(page)

    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 200, y: 200 }, { x: 400, y: 350 })

    await pickTool(page, "select")
    const box = (await svg.boundingBox())!
    await page.mouse.click(box.x + 300, box.y + 275)
    expect(await selectedCount(page)).toBe(1)

    const before = await readElements(page)

    const center = await getHandleCenter(page)
    const r = 105
    const endX = center.x + r
    const endY = center.y + r

    await page.mouse.move(center.x, center.y)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 8 })
    await page.mouse.up()

    const after = await readElements(page)
    expect(after).toHaveLength(1)
    expect(after[0].rotation).toBeCloseTo(90, 0)
    expect(after[0].x).toBe(before[0].x)
    expect(after[0].y).toBe(before[0].y)
  })
})
