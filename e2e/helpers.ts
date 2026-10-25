import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Shape of the `AdrawCanvas` state we read back from the page. The vanilla
 * example exposes the live instance on `window.adraw` for testing.
 */
export interface CanvasSnapshot {
  activeTool: string
  elementCount: number
  elementTypes: string[]
  isToolLocked: boolean
  selectedCount: number
  zoom: number
  canUndo: boolean
  canRedo: boolean
}

/** Load the demo and wait for the canvas to mount. */
export async function openCanvas(page: Page): Promise<Locator> {
  await page.goto("/")
  const svg = page.locator(".canvas-container svg")
  await expect(svg).toBeVisible()
  // The instance is assigned right after mount; make sure it is ready before
  // any test reads state from it.
  await page.waitForFunction(() => Boolean((window as any).adraw))
  return svg
}

/** Read the current canvas state from the exposed instance. */
export function snapshot(page: Page): Promise<CanvasSnapshot> {
  return page.evaluate<CanvasSnapshot>(() => {
    const canvas = (window as any).adraw
    const elements = [...canvas.getElements().values()]
    return {
      activeTool: canvas.getActiveTool(),
      canRedo: canvas.canRedo(),
      canUndo: canvas.canUndo(),
      elementCount: elements.length,
      elementTypes: elements.map((element: any) => element.type),
      isToolLocked: canvas.getIsToolLocked(),
      selectedCount: canvas.getSelectedIds().size,
      zoom: canvas.getViewport().zoom,
    }
  })
}

/** Convenience reader for the number of currently selected elements. */
export async function selectedCount(page: Page): Promise<number> {
  const state = await snapshot(page)
  return state.selectedCount
}

/** Click a toolbar tool button, e.g. `rectangle`, `ellipse`, `select`. */
export function pickTool(page: Page, tool: string): Promise<void> {
  return page.locator(`.toolbar button[data-tool="${tool}"]`).click()
}

/** Click a toolbar action button, e.g. `undo`, `redo`, `zoom-in`. */
export function clickAction(page: Page, action: string): Promise<void> {
  return page.locator(`.toolbar button[data-action="${action}"]`).click()
}

/**
 * Drag on the canvas from one point to another (offsets are relative to the
 * SVG's top-left corner). Used to draw shapes and freehand strokes.
 */
export async function drag(
  page: Page,
  svg: Locator,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 8,
): Promise<void> {
  const box = await svg.boundingBox()
  if (!box) {
    throw new Error("canvas svg has no bounding box")
  }
  await page.mouse.move(box.x + from.x, box.y + from.y)
  await page.mouse.down()
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps })
  await page.mouse.up()
}
