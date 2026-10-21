import { expect, test } from "@playwright/test"

import { drag, openCanvas, pickTool, snapshot } from "./helpers"

test.describe("text tool", () => {
  test("creates a text element by typing into the inline editor", async ({
    page,
  }, testInfo) => {
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
    await expect(editor).toHaveCSS("border-top-width", "0px")
    await expect(editor).toHaveCSS("padding-left", "0px")

    const editingState = await snapshot(page)
    expect(editingState.activeTool).toBe("select")
    expect(editingState.selectedCount).toBe(0)

    await editor.fill("Hello adraw")

    const editingText = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
    })
    const textGroup = page.locator(
      `.adraw-elements-group [id="${editingText.id}"]`,
    )
    await expect(textGroup).toHaveCSS("visibility", "hidden")
    // WebKit only exposes the prefixed property for SVG text.
    await expect(textGroup.locator("text")).toHaveCSS(
      testInfo.project.name === "webkit"
        ? "-webkit-user-select"
        : "user-select",
      "none",
    )
    await page.keyboard.press("Escape")

    const state = await snapshot(page)
    expect(state.elementTypes).toContain("text")
    expect(state.activeTool).toBe("select")
    expect(state.selectedCount).toBe(1)

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const element = [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
      return element
    })
    expect(text.text).toBe("Hello adraw")
    expect(text.autoSize).toBe(true)
    expect(text.fontFamily).toBe("system-ui, sans-serif")
  })

  test("Enter inserts a newline and Ctrl+Enter commits", async ({ page }) => {
    await openCanvas(page)
    await pickTool(page, "text")

    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + 200, box.y + 200)

    const editor = page.locator("textarea.adraw-text-editor")
    await editor.fill("line one")
    await page.keyboard.press("Enter")
    await page.keyboard.type("line two")
    await expect(editor).toHaveValue("line one\nline two")
    await expect(editor).toBeVisible()
    await page.keyboard.press("Control+Enter")
    await expect(editor).toHaveCount(0)

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
    })
    expect(text.text).toBe("line one\nline two")

    const lines = await page.locator(".adraw-elements-group text tspan").all()
    expect(lines).toHaveLength(2)
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
    expect(state.activeTool).toBe("select")
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
    await page.keyboard.press("Escape")
    await expect(page.locator("textarea.adraw-text-editor")).toHaveCount(0)

    // The committed element is selected; double-click it to re-open the
    // editor (the text element is placed at the click point).
    await page.mouse.dblclick(box.x + 200, box.y + 200)
    await expect(editor).toBeVisible()
    await expect(editor).toHaveValue("Hello")
    await editor.fill("Edited")
    await page.keyboard.press("Escape")

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()][0]
    })
    expect(text.text).toBe("Edited")
  })

  test("double-clicking empty canvas creates the same auto-sized editor", async ({
    page,
  }) => {
    await openCanvas(page)
    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }

    await page.mouse.dblclick(box.x + 300, box.y + 300)

    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toBeVisible()
    await editor.fill("Hello from double click")
    await page.keyboard.press("Enter")
    await page.keyboard.type("second line")

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
    })
    expect(text.autoSize).toBe(true)
    expect(text.width).toBeGreaterThan(100)
    expect(text.height).toBeCloseTo(text.fontSize * text.lineHeight * 2, 0)

    const size = await editor.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: parseFloat(style.height),
        width: parseFloat(style.width),
      }
    })
    expect(size.width).toBeCloseTo(text.width, 0)
    expect(size.height).toBeCloseTo(text.height, 0)

    await page.keyboard.press("Escape")
    await expect(page.locator("textarea.adraw-text-editor")).toHaveCount(0)

    const committed = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
    })
    expect(committed.text).toBe("Hello from double click\nsecond line")
  })

  test("applies text style options, alignment and line height", async ({
    page,
  }) => {
    await openCanvas(page)
    await page.evaluate(() => {
      ;(window as any).adraw.setToolOptions("text", {
        fontFamily: "monospace",
        lineHeight: 1.5,
        textAlign: "center",
      })
    })
    await pickTool(page, "text")

    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    await page.mouse.click(box.x + 200, box.y + 200)

    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toHaveCSS("font-family", "monospace")
    await expect(editor).toHaveCSS("text-align", "center")
    await editor.fill("Hi")
    await page.keyboard.press("Escape")

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
    })
    expect(text.fontFamily).toBe("monospace")
    expect(text.textAlign).toBe("center")
    expect(text.lineHeight).toBe(1.5)
    expect(text.height).toBeCloseTo(text.fontSize * 1.5)

    const rendered = page.locator(
      `.adraw-elements-group [id="${text.id}"] text`,
    )
    await expect(rendered).toHaveAttribute("font-family", "monospace")
    await expect(rendered).toHaveAttribute("text-anchor", "middle")
  })

  test("clicking with the text tool edits an existing text instead of stacking one", async ({
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
    await editor.fill("One")
    await page.keyboard.press("Escape")

    await pickTool(page, "text")
    await page.mouse.click(box.x + 200, box.y + 200)
    await expect(editor).toBeVisible()
    await expect(editor).toHaveValue("One")

    const state = await snapshot(page)
    expect(state.elementCount).toBe(1)

    await page.keyboard.press("Escape")
  })

  test("dragging with the text tool creates a fixed-width text", async ({
    page,
  }) => {
    await openCanvas(page)
    await pickTool(page, "text")

    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }
    const start = { x: 200, y: 200 }
    await page.mouse.move(box.x + start.x, box.y + start.y)
    await page.mouse.down()
    await page.mouse.move(box.x + start.x + 140, box.y + start.y, {
      steps: 6,
    })
    await page.mouse.up()

    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toBeVisible()
    await editor.fill("This label wraps inside a fixed width")
    await page.keyboard.press("Escape")

    const text = await page.evaluate(() => {
      const canvas = (window as any).adraw
      return [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
    })
    expect(text.autoSize).toBe(false)
    expect(text.width).toBeCloseTo(140, 0)
    expect(text.text).toBe("This label wraps inside a fixed width")
  })

  test("double-clicking a shape adds a centered label that follows it", async ({
    page,
  }) => {
    await openCanvas(page)
    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }

    await pickTool(page, "rectangle")
    await drag(page, svg, { x: 200, y: 150 }, { x: 400, y: 300 })
    await pickTool(page, "select")

    await page.mouse.dblclick(box.x + 300, box.y + 225)
    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toBeVisible()
    await editor.fill("Label")

    const editing = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const text = [...canvas.getElements().values()].find(
        (el: any) => el.type === "text",
      )
      const element = document.querySelector<HTMLTextAreaElement>(
        "textarea.adraw-text-editor",
      )
      return {
        activeTool: canvas.getActiveTool(),
        editorWidth: element ? parseFloat(getComputedStyle(element).width) : 0,
        selectedCount: canvas.getSelectedIds().size,
        textWidth: text.width,
        wrapWidth: text.wrapWidth,
      }
    })
    expect(editing.activeTool).toBe("select")
    expect(editing.selectedCount).toBe(0)
    expect(editing.textWidth).toBeLessThan(editing.wrapWidth)
    expect(editing.editorWidth).toBeCloseTo(editing.textWidth, 0)

    await page.keyboard.press("Escape")

    const before = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const elements = [...canvas.getElements().values()]
      const rect = elements.find((el: any) => el.type === "rectangle")
      const text = elements.find((el: any) => el.type === "text")
      return { rect, text }
    })
    expect(before.text.containerId).toBe(before.rect.id)
    expect(before.text.text).toBe("Label")
    expect(before.text.textAlign).toBe("center")
    expect(before.text.wrapWidth).toBe(190)
    expect(before.text.width).toBeLessThan(before.text.wrapWidth)
    expect(before.text.x + before.text.width / 2).toBeCloseTo(
      before.rect.x + before.rect.width / 2,
      0,
    )

    // Dragging the shape by its label moves the label with it.
    await page.mouse.move(box.x + 300, box.y + 225)
    await page.mouse.down()
    await page.mouse.move(box.x + 350, box.y + 260, { steps: 6 })
    await page.mouse.up()

    const after = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const elements = [...canvas.getElements().values()]
      return {
        rect: elements.find((el: any) => el.type === "rectangle"),
        text: elements.find((el: any) => el.type === "text"),
      }
    })
    expect(after.rect.x).toBeCloseTo(before.rect.x + 50, 0)
    expect(after.rect.y).toBeCloseTo(before.rect.y + 35, 0)
    expect(after.text.x + after.text.width / 2).toBeCloseTo(
      after.rect.x + after.rect.width / 2,
      0,
    )
    expect(after.text.y + after.text.height / 2).toBeCloseTo(
      after.rect.y + after.rect.height / 2,
      0,
    )
  })

  test("clicking an arrow with the text tool creates a label on the line", async ({
    page,
  }) => {
    await openCanvas(page)
    const svg = page.locator(".canvas-container svg")
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas svg has no bounding box")
    }

    await pickTool(page, "arrow")
    await drag(page, svg, { x: 200, y: 400 }, { x: 400, y: 400 })
    await pickTool(page, "text")

    await page.mouse.click(box.x + 300, box.y + 400)
    const editor = page.locator("textarea.adraw-text-editor")
    await expect(editor).toBeVisible()
    await editor.fill("label")
    await page.keyboard.press("Escape")

    const result = await page.evaluate(() => {
      const canvas = (window as any).adraw
      const elements = [...canvas.getElements().values()]
      return {
        arrow: elements.find((el: any) => el.type === "arrow"),
        text: elements.find((el: any) => el.type === "text"),
      }
    })
    expect(result.text.containerId).toBe(result.arrow.id)
    expect(result.text.labelPosition).toBe(0.5)
    expect(result.text.x + result.text.width / 2).toBeCloseTo(
      result.arrow.startX + (result.arrow.endX - result.arrow.startX) * 0.5,
      0,
    )

    const shafts = await page.evaluate(
      ({ arrowId }) => {
        const group = document.getElementById(arrowId)
        return [...(group?.querySelectorAll("line") ?? [])].map((line) => ({
          display: line.getAttribute("display"),
          x1: Number(line.getAttribute("x1")),
          x2: Number(line.getAttribute("x2")),
        }))
      },
      { arrowId: result.arrow.id },
    )

    expect(shafts).toHaveLength(2)
    expect(shafts[0].display).toBeNull()
    expect(shafts[0].x2).toBeLessThan(result.text.x)
    expect(shafts[1].display).toBeNull()
    expect(shafts[1].x1).toBeGreaterThan(result.text.x + result.text.width)
  })
})
