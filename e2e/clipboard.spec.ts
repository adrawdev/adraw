import { expect, test } from "@playwright/test"

import { clickAction, drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("clipboard", () => {
  test("toolbar copy and paste duplicate the selected element", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 200 })

    const initial = await snapshot(page)
    expect(initial.elementCount).toBe(1)

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
    const afterCut = await snapshot(page)
    expect(afterCut.elementCount).toBe(0)

    await clickAction(page, "paste")
    const afterPaste = await snapshot(page)
    expect(afterPaste.elementCount).toBe(1)
  })

  test("Ctrl+C / Ctrl+V duplicate the selection", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 200 })

    await page.keyboard.press("Control+c")
    await page.keyboard.press("Control+v")

    const state = await snapshot(page)
    expect(state.elementCount).toBe(2)
  })

  test("pastes content copied in another tab", async ({ context, page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 120, y: 120 }, { x: 220, y: 200 })

    await page.keyboard.press("Control+c")

    const target = await context.newPage()
    const targetSvg = await openCanvas(target)
    const targetBox = await targetSvg.boundingBox()
    if (!targetBox) {
      throw new Error("target canvas has no bounding box")
    }
    await target.mouse.click(targetBox.x + 600, targetBox.y + 400)
    await target.keyboard.press("Control+v")

    await expect
      .poll(async () => {
        const targetState = await snapshot(target)
        return targetState.elementCount
      })
      .toBe(1)
    const state = await snapshot(target)
    expect(state.elementTypes).toEqual(["rectangle"])
    await target.close()
  })
})
