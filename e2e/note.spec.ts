import { expect, test, type Page } from "@playwright/test"

import { drag, openCanvas, pickTool, snapshot } from "./helpers"

function readNote(page: Page) {
  return page.evaluate(() => {
    const canvas = (window as any).adraw
    return (
      [...canvas.getElements().values()].find(
        (element: any) => element.type === "note",
      ) ?? null
    )
  })
}

test.describe("note tool", () => {
  test("clicking places a sticky note and opens the editor", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "note")

    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    const editor = page.locator("textarea")
    await expect(editor).toBeVisible()
    await expect(editor).toHaveValue("")

    await editor.fill("Buy milk")
    await page.keyboard.press("Control+Enter")
    await expect(editor).toHaveCount(0)

    const note = await readNote(page)
    expect(note).toMatchObject({ text: "Buy milk", type: "note" })
    expect(note.width).toBe(200)
    expect(note.height).toBe(200)

    const group = page.locator(`[id="${note.id}"]`)
    await expect(group.locator("rect")).toBeVisible()
    await expect(group.locator("path")).toHaveCount(1)
    await expect(group.locator("text")).toHaveText("Buy milk")
  })

  test("dragging sizes the note and opens its editor", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "note")

    await drag(page, svg, { x: 300, y: 200 }, { x: 500, y: 400 })

    await expect(page.locator("textarea")).toBeVisible()
    await page.keyboard.press("Escape")

    const note = await readNote(page)
    expect(note.width).toBeCloseTo(200, 0)
    expect(note.height).toBeCloseTo(200, 0)
  })

  test("creates back-to-back notes with the tool locked", async ({ page }) => {
    const svg = await openCanvas(page)
    await page.locator("#tool-lock").check()
    await pickTool(page, "note")

    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }

    await page.mouse.click(box.x + 200, box.y + 150)
    const editor = page.locator("textarea")
    await editor.fill("First")

    // The same click commits the open note and creates the next one.
    await page.mouse.click(box.x + 500, box.y + 300)

    await expect(page.locator("textarea")).toHaveCount(1)
    await expect(page.locator("textarea")).toHaveValue("")

    const texts = await page.evaluate(() =>
      [...(window as any).adraw.getElements().values()]
        .filter((element: any) => element.type === "note")
        .map((element: any) => element.text),
    )
    expect(texts).toEqual(["First", ""])

    const state = await snapshot(page)
    expect(state.activeTool).toBe("note")
    expect(state.selectedCount).toBe(0)
    expect(state.elementTypes.filter((type) => type === "note")).toHaveLength(2)
  })

  test("keeps canvas shortcuts working after Escape commits the editor", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await page.locator("#tool-lock").check()
    await pickTool(page, "note")

    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }

    await page.mouse.click(box.x + 300, box.y + 200)
    const editor = page.locator("textarea")
    await editor.fill("Note")
    await page.keyboard.press("Escape")
    await expect(editor).toHaveCount(0)

    // Escape returns focus to the canvas, so Q still toggles the lock.
    await page.keyboard.press("q")
    const state = await snapshot(page)
    expect(state.isToolLocked).toBe(false)
    expect(state.selectedCount).toBe(0)
    await expect(page.locator("#tool-lock")).not.toBeChecked()
  })

  test("double-clicking an existing note edits it in place", async ({
    page,
  }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "note")

    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + 200, box.y + 150)
    const editor = page.locator("textarea")
    await editor.fill("First")
    await page.keyboard.press("Control+Enter")

    await page.mouse.dblclick(box.x + 200, box.y + 150)
    await expect(editor).toBeVisible()
    await expect(editor).toHaveValue("First")
    await editor.fill("Second")
    await page.keyboard.press("Control+Enter")

    const state = await snapshot(page)
    expect(state.elementTypes.filter((type) => type === "note")).toHaveLength(1)
    const updated = await readNote(page)
    expect(updated.text).toBe("Second")
  })
})
