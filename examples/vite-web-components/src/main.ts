import "./index.css"
import type { ToolType } from "@adraw/core"
import {
  type AdrawCanvasElement,
  defineAdrawCanvas,
} from "@adraw/web-components"

// Registers <adraw-canvas>, upgrading the element already present in index.html.
defineAdrawCanvas()

const canvas = document.querySelector<AdrawCanvasElement>("adraw-canvas")!

const buttons = document.querySelectorAll<HTMLButtonElement>("[data-tool]")
buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    canvas.canvas?.setActiveTool(btn.dataset.tool as ToolType)
    updateToolbar()
  })
})

const actionButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-action]")
actionButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    switch (btn.dataset.action) {
      case "undo": {
        canvas.canvas?.undo()
        break
      }
      case "redo": {
        canvas.canvas?.redo()
        break
      }
      case "copy": {
        canvas.canvas?.copy()
        break
      }
      case "cut": {
        canvas.canvas?.cut()
        break
      }
      case "paste": {
        canvas.canvas?.paste()
        break
      }
      case "zoom-in": {
        canvas.canvas?.zoomIn()
        break
      }
      case "zoom-out": {
        canvas.canvas?.zoomOut()
        break
      }
      case "zoom-fit": {
        canvas.canvas?.zoomToFit()
        break
      }
      case "reset": {
        canvas.canvas?.resetZoom()
        break
      }
    }
  })
})

function updateToolbar() {
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === canvas.activeTool)
  })
}

// Keep the toolbar in sync when the tool changes from anywhere (e.g. keyboard
// shortcuts), not only when a toolbar button is clicked.
canvas.addEventListener("adraw:toolchange", updateToolbar)

updateToolbar()

// Expose the element so end-to-end tests can assert on real state.
;(globalThis as unknown as { adraw?: AdrawCanvasElement }).adraw = canvas
