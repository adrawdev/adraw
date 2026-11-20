import { expect, type Page, test } from "@playwright/test"

import { openCanvas } from "./helpers"

interface FilePayload {
  body: string
  name: string
  type: string
}

interface MediaSnapshot {
  height: number
  type: string
  width: number
  x: number
  y: number
}

function svgImage(width: number, height: number, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`
}

async function mediaElements(page: Page): Promise<MediaSnapshot[]> {
  return page.evaluate(() =>
    [...(window as any).adraw.getElements().values()]
      .filter((element: any) => element.type === "media")
      .map((element: any) => ({
        height: element.height,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y,
      })),
  )
}

async function dispatchDrop(
  page: Page,
  files: FilePayload[],
  clientX: number,
  clientY: number,
): Promise<boolean> {
  return page.evaluate(
    ({ files: droppedFiles, clientX: dropX, clientY: dropY }) => {
      const transfer = new DataTransfer()
      for (const file of droppedFiles) {
        transfer.items.add(
          new File([file.body], file.name, { type: file.type }),
        )
      }
      const event = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientX: dropX,
        clientY: dropY,
        dataTransfer: transfer,
      })
      document.querySelector(".canvas-container")!.dispatchEvent(event)
      return event.defaultPrevented
    },
    { clientX, clientY, files },
  )
}

async function dispatchPaste(
  page: Page,
  files: FilePayload[],
): Promise<boolean> {
  return page.evaluate((pasteFiles) => {
    const transfer = new DataTransfer()
    for (const file of pasteFiles) {
      transfer.items.add(new File([file.body], file.name, { type: file.type }))
    }
    const event = new Event("paste", {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent
    Object.defineProperty(event, "clipboardData", { value: transfer })
    document.querySelector(".canvas-container svg")!.dispatchEvent(event)
    return event.defaultPrevented
  }, files)
}

test.describe("file drop and image paste", () => {
  test("drops an image centered on the pointer", async ({ page }) => {
    const svg = await openCanvas(page)
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas has no bounding box")
    }
    const clientX = box.x + box.width / 2
    const clientY = box.y + box.height / 2

    const prevented = await dispatchDrop(
      page,
      [
        {
          body: svgImage(200, 100, "tomato"),
          name: "wide.svg",
          type: "image/svg+xml",
        },
      ],
      clientX,
      clientY,
    )

    expect(prevented).toBe(true)
    await expect
      .poll(async () => {
        const images = await mediaElements(page)
        return images.length
      })
      .toBe(1)
    const [image] = await mediaElements(page)
    expect(image.type).toBe("media")
    expect(image.width / image.height).toBeCloseTo(2)
    expect(Math.abs(image.x + image.width / 2)).toBeLessThan(1)
    expect(Math.abs(image.y + image.height / 2)).toBeLessThan(1)
  })

  test("drops multiple images centered on the pointer", async ({ page }) => {
    const svg = await openCanvas(page)
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas has no bounding box")
    }

    await dispatchDrop(
      page,
      [
        {
          body: svgImage(200, 100, "red"),
          name: "wide.svg",
          type: "image/svg+xml",
        },
        {
          body: svgImage(100, 300, "blue"),
          name: "tall.svg",
          type: "image/svg+xml",
        },
      ],
      box.x + box.width / 2,
      box.y + box.height / 2,
    )

    await expect
      .poll(async () => {
        const images = await mediaElements(page)
        return images.length
      })
      .toBe(2)
    const [first, second] = await mediaElements(page)
    expect(first.width / first.height).toBeCloseTo(2)
    expect(second.width / second.height).toBeCloseTo(1 / 3)
    expect(Math.abs(first.x + first.width / 2)).toBeLessThan(1)
    expect(Math.abs(second.x + second.width / 2)).toBeLessThan(1)
  })

  test("pastes an image at the last pointer position", async ({ page }) => {
    const svg = await openCanvas(page)
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas has no bounding box")
    }
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2)

    const prevented = await dispatchPaste(page, [
      {
        body: svgImage(120, 80, "green"),
        name: "pasted.svg",
        type: "image/svg+xml",
      },
    ])

    expect(prevented).toBe(true)
    await expect
      .poll(async () => {
        const images = await mediaElements(page)
        return images.length
      })
      .toBe(1)
    const [image] = await mediaElements(page)
    expect(image.x + image.width / 2).toBeCloseTo(100)
    expect(Math.abs(image.y + image.height / 2)).toBeLessThan(1)
  })

  test("reports unsupported files without navigating", async ({ page }) => {
    const svg = await openCanvas(page)
    const box = await svg.boundingBox()
    if (!box) {
      throw new Error("canvas has no bounding box")
    }
    const warnings: string[] = []
    page.on("console", (message) => {
      if (message.type() === "warning") {
        warnings.push(message.text())
      }
    })

    const prevented = await dispatchDrop(
      page,
      [{ body: "hello", name: "notes.txt", type: "text/plain" }],
      box.x + box.width / 2,
      box.y + box.height / 2,
    )

    expect(prevented).toBe(true)
    await expect.poll(() => warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('ignored "notes.txt"')
    expect(await mediaElements(page)).toHaveLength(0)
  })
})
