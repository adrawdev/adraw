import { expect, test } from "@playwright/test"

import { openCanvas, pickTool, snapshot } from "./helpers"

test.describe("tool selection", () => {
  const tools = [
    "hand",
    "rectangle",
    "ellipse",
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

  test.describe("keyboard shortcuts", () => {
    const shortcuts: [string, string][] = [
      ["r", "rectangle"],
      ["e", "eraser"],
      ["d", "draw"],
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
