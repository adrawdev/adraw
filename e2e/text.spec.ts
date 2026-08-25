import { expect, test } from "@playwright/test"

import { openCanvas, pickTool, snapshot } from "./helpers"

test.describe("text tool", () => {
  test("creates a text element by typing into the inline editor", async ({
    page,
  }) => {
    await openCanvas(page)
    await pickTool(page, "text")

    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + 200, box.y + 200)

    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toBeVisible()
    await editor.fill("Hello adraw")
    await expect(
      page.locator(".adraw-elements-group .adraw-temporary"),
    ).toHaveCSS("visibility", "hidden")
    await page.keyboard.press("Enter")

    const state = await snapshot(page)
    expect(state.elementTypes).toContain("text")
    expect(state.activeTool).toBe("select")

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const element = [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
      return element
    })
    expect(text.text).toBe("Hello adraw")
  })

  test("does not create an element when the text is empty", async ({
    page,
  }) => {
    await openCanvas(page)
    await pickTool(page, "text")

    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + 200, box.y + 200)

    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toBeVisible()
    await page.keyboard.press("Escape")

    const state = await snapshot(page)
    expect(state.elementCount).toBe(0)
    expect(state.activeTool).toBe("text")
  })

  test("double-clicking an existing text element opens the editor and edits it", async ({
    page,
  }) => {
    await openCanvas(page)
    await pickTool(page, "text")

    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + 200, box.y + 200)

    const editor = page.locator("textarea.adraw-text-editor")
    await editor.fill("Hello")
    await page.keyboard.press("Enter")
    await expect(page.locator("textarea.adraw-text-editor")).toHaveCount(0)

    // The committed element is selected; double-click the canvas center to
    // re-open the editor (the text element is placed at the click point).
    await page.mouse.dblclick(box.x + 200, box.y + 200)
    await expect(editor).toBeVisible()
    await expect(editor).toHaveValue("Hello")
    await editor.fill("Edited")
    await page.keyboard.press("Enter")

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()][0]
    })
    expect(text.text).toBe("Edited")
  })
})
