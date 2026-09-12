import { expect, test } from "@playwright/test"

import { openCanvas, snapshot } from "./helpers"

test.describe("app shell", () => {
  test("mounts the canvas and toolbar", async ({ page }) => {
    const svg = await openCanvas(page)

    await expect(page).toHaveTitle(/adraw/)
    await expect(page.locator(".toolbar")).toBeVisible()
    // The SVG is created inside the canvas container by the DOM adapter.
    await expect(svg).toHaveAttribute("width", "100%")
    await expect(
      page.locator(".canvas-container svg .adraw-elements-group"),
    ).toBeAttached()
  })

  test("exposes every tool and action button", async ({ page }) => {
    await openCanvas(page)

    const tools = [
      "select",
      "hand",
      "rectangle",
      "ellipse",
      "draw",
      "line",
      "arrow",
      "text",
      "eraser",
    ]
    await Promise.all(
      tools.map((tool) =>
        expect(
          page.locator(`.toolbar button[data-tool="${tool}"]`),
        ).toBeVisible(),
      ),
    )

    const actions = ["undo", "redo", "zoom-in", "zoom-out", "zoom-fit", "reset"]
    await Promise.all(
      actions.map((action) =>
        expect(
          page.locator(`.toolbar button[data-action="${action}"]`),
        ).toBeVisible(),
      ),
    )
  })

  test("starts with an empty canvas on the select tool", async ({ page }) => {
    await openCanvas(page)

    const { activeTool } = await snapshot(page)
    expect(activeTool).toBe("select")
    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(0)
  })
})
