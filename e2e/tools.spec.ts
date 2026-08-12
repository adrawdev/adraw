import { expect, test } from "@playwright/test"

import { openCanvas, pickTool, snapshot } from "./helpers"

test.describe("tool selection", () => {
  const tools = [
    "hand",
    "rectangle",
    "ellipse",
    "draw",
    "eraser",
    "text",
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
    ]

    for (const [key, tool] of shortcuts) {
      test(`"${key}" selects the ${tool} tool`, async ({ page }) => {
        await openCanvas(page)
        await page.keyboard.press(key)

        const state = await snapshot(page)
        expect(state.activeTool).toBe(tool)
      })
    }

    test("the toolbar reflects a keyboard-driven tool change", async ({
      page,
    }) => {
      await openCanvas(page)
      await page.keyboard.press("r")

      await expect(
        page.locator('.toolbar button[data-tool="rectangle"]'),
      ).toHaveClass(/active/)
    })
  })
})
