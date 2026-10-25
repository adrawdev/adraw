import { expect, test } from "@playwright/test"

import { drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("drawing", () => {
  test("drags a rectangle onto the canvas", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 150, y: 150 }, { x: 320, y: 280 })

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(1)
    const state = await snapshot(page)
    expect(state.elementCount).toBe(1)
    expect(state.elementTypes).toEqual(["rectangle"])
    // A committed shape produces an undo entry.
    expect(state.canUndo).toBe(true)
  })

  test("drags an ellipse onto the canvas", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "ellipse")
    await drag(page, svg, { x: 200, y: 160 }, { x: 360, y: 300 })

    await expect(page.locator(".adraw-elements-group ellipse")).toHaveCount(1)
    const state = await snapshot(page)
    expect(state.elementTypes).toEqual(["ellipse"])
  })

  test("drags a diamond onto the canvas", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "diamond")
    await drag(page, svg, { x: 180, y: 140 }, { x: 340, y: 300 })

    await expect(page.locator(".adraw-elements-group polygon")).toHaveCount(1)
    const state = await snapshot(page)
    expect(state.elementTypes).toEqual(["diamond"])
  })

  test("draws a freehand path", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "draw")
    await drag(page, svg, { x: 120, y: 120 }, { x: 300, y: 260 }, 20)

    await expect(page.locator(".adraw-elements-group path")).toHaveCount(1)
    const state = await snapshot(page)
    expect(state.elementTypes).toEqual(["path"])
  })

  test("does not commit a rectangle from a tiny drag", async ({ page }) => {
    const svg = await openCanvas(page)
    await pickTool(page, "rectangle")
    // Below the 5px minimum-size threshold in the rectangle tool.
    await drag(page, svg, { x: 200, y: 200 }, { x: 202, y: 202 }, 1)

    const state = await snapshot(page)
    expect(state.elementCount).toBe(0)
  })

  test("accumulates multiple elements", async ({ page }) => {
    const svg = await openCanvas(page)

    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 100, y: 100 }, { x: 200, y: 200 })

    await pickTool(page, "ellipse")
    await drag(page, svg, { x: 260, y: 120 }, { x: 380, y: 240 })

    await expect(
      page.locator(".adraw-elements-group .adraw-element"),
    ).toHaveCount(2)
    const state = await snapshot(page)
    expect(state.elementCount).toBe(2)
    expect(state.elementTypes.toSorted()).toEqual(["ellipse", "rectangle"])
  })
})
