import { expect, test } from "@playwright/test"

import { drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("tool selection", () => {
  const tools = [
    "hand",
    "rectangle",
    "ellipse",
    "diamond",
    "draw",
    "line",
    "arrow",
    "eraser",
    "text",
    "note",
    "select",
  ]

  for (const tool of tools) {
    test(`clicking the ${tool} button activates it`, async ({ page }) => {
      await openCanvas(page)
      await pickTool(page, tool)

      await expect(
        page.locator(`.toolbar button[data-tool="${tool}"]`),
      ).toHaveClass(/active/)
      const state = await snapshot(page)
      expect(state.activeTool).toBe(tool)
    })
  }

  test("only one tool button is active at a time", async ({ page }) => {
    await openCanvas(page)

    await pickTool(page, "rectangle")
    await pickTool(page, "ellipse")

    await expect(page.locator(".toolbar button[data-tool].active")).toHaveCount(
      1,
    )
    await expect(
      page.locator('.toolbar button[data-tool="ellipse"]'),
    ).toHaveClass(/active/)
  })

  test.describe("keeping the tool active", () => {
    test("switches back to select after drawing by default", async ({
      page,
    }) => {
      const svg = await openCanvas(page)

      await pickTool(page, "rectangle")
      await drag(page, svg, { x: 100, y: 100 }, { x: 200, y: 200 })

      const state = await snapshot(page)
      expect(state.elementCount).toBe(1)
      expect(state.activeTool).toBe("select")
    })

    test("keeps the drawing tool active when the toggle is on", async ({
      page,
    }) => {
      const svg = await openCanvas(page)

      await page.locator("#tool-lock").check()
      await pickTool(page, "rectangle")
      await drag(page, svg, { x: 100, y: 100 }, { x: 200, y: 200 })

      const state = await snapshot(page)
      expect(state.elementCount).toBe(1)
      expect(state.activeTool).toBe("rectangle")
      expect(state.selectedCount).toBe(0)

      // A second shape can be drawn immediately without reselecting the tool.
      await drag(page, svg, { x: 250, y: 100 }, { x: 320, y: 180 })

      const afterSecond = await snapshot(page)
      expect(afterSecond.elementCount).toBe(2)
      expect(afterSecond.activeTool).toBe("rectangle")
      expect(afterSecond.selectedCount).toBe(0)
    })
  })

  test.describe("keyboard shortcuts", () => {
    const shortcuts: [string, string][] = [
      ["r", "rectangle"],
      ["e", "eraser"],
      ["d", "diamond"],
      ["p", "draw"],
      ["h", "hand"],
      ["v", "select"],
      ["t", "text"],
      ["n", "note"],
      ["a", "arrow"],
    ]

    for (const [key, tool] of shortcuts) {
      test(`"${key}" selects the ${tool} tool`, async ({ page }) => {
        const svg = await openCanvas(page)
        await svg.focus()
        await page.keyboard.press(key)

        const state = await snapshot(page)
        expect(state.activeTool).toBe(tool)
      })
    }

    test('"q" toggles the tool lock', async ({ page }) => {
      const svg = await openCanvas(page)
      await svg.focus()
      await page.keyboard.press("q")

      await expect(page.locator("#tool-lock")).toBeChecked()
      const lockedByShortcut = await snapshot(page)
      expect(lockedByShortcut.isToolLocked).toBe(true)

      await pickTool(page, "rectangle")
      await drag(page, svg, { x: 100, y: 100 }, { x: 200, y: 200 })
      const locked = await snapshot(page)
      expect(locked.activeTool).toBe("rectangle")

      // Drawing focuses the canvas, so Q works without refocusing.
      await page.keyboard.press("q")
      await expect(page.locator("#tool-lock")).not.toBeChecked()
      const unlocked = await snapshot(page)
      expect(unlocked.isToolLocked).toBe(false)

      await drag(page, svg, { x: 250, y: 100 }, { x: 320, y: 180 })
      const afterSecond = await snapshot(page)
      expect(afterSecond.activeTool).toBe("select")
    })

    test("the toolbar reflects a keyboard-driven tool change", async ({
      page,
    }) => {
      const svg = await openCanvas(page)
      await svg.focus()
      await page.keyboard.press("r")

      await expect(
        page.locator('.toolbar button[data-tool="rectangle"]'),
      ).toHaveClass(/active/)
    })

    test("shortcuts stay scoped to the canvas", async ({ page }) => {
      const svg = await openCanvas(page)

      await page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      )
      await page.keyboard.press("r")
      const blurred = await snapshot(page)
      expect(blurred.activeTool).toBe("select")

      await svg.click({ position: { x: 20, y: 20 } })
      await page.keyboard.press("r")
      const focused = await snapshot(page)
      expect(focused.activeTool).toBe("rectangle")
    })
  })
})
