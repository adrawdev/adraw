import "./index.css"
import { AdrawCanvas, type ToolType, type MediaInput } from "@adraw/core"

const toolbar = document.querySelector<HTMLDivElement>(".toolbar")!
const canvasContainer =
  document.querySelector<HTMLDivElement>(".canvas-container")!

const vanilla = new AdrawCanvas({
  container: canvasContainer,
})

const buttons = toolbar.querySelectorAll<HTMLButtonElement>("[data-tool]")
buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tool = btn.dataset.tool as ToolType
    vanilla.setActiveTool(tool)
    updateToolbar()
  })
})

const actionButtons =
  toolbar.querySelectorAll<HTMLButtonElement>("[data-action]")
actionButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const { action } = btn.dataset
    switch (action) {
      case "undo": {
        vanilla.undo()
        break
      }
      case "redo": {
        vanilla.redo()
        break
      }
      case "copy": {
        vanilla.copy()
        break
      }
      case "cut": {
        vanilla.cut()
        break
      }
      case "paste": {
        vanilla.paste()
        break
      }
      case "zoom-in": {
        vanilla.zoomIn()
        break
      }
      case "zoom-out": {
        vanilla.zoomOut()
        break
      }
      case "zoom-fit": {
        vanilla.zoomToFit()
        break
      }
      case "reset": {
        vanilla.resetZoom()
        break
      }
    }
  })
})

function updateToolbar() {
  const activeTool = vanilla.getActiveTool()
  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === activeTool)
  })
}

// Keep the toolbar in sync when the tool changes from anywhere (e.g. keyboard
// shortcuts), not only when a toolbar button is clicked.
vanilla.on("toolChange", updateToolbar)

updateToolbar()

// Media insertion
const fileInput = document.getElementById("file-input") as HTMLInputElement

fileInput.addEventListener("change", async () => {
  const files = fileInput.files
  if (!files || files.length === 0) {
    return
  }

  const descriptors: MediaInput[] = await Promise.all(
    Array.from(files, async (file) => {
      const dataUrl = await readFileAsDataURL(file)
      const img = await getImageFromSrc(dataUrl)
      return {
        mimeType: file.type,
        naturalHeight: img.naturalHeight,
        naturalWidth: img.naturalWidth,
        src: dataUrl,
      }
    }),
  )

  if (descriptors.length > 0) {
    vanilla.insertMedia(descriptors)
  }

  fileInput.value = ""
})

const readFileAsDataURL = (file: File | Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.addEventListener("load", (ev) => {
      if (ev.target?.readyState === FileReader.DONE) {
        resolve(ev.target.result as string)
      } else {
        reject(new Error("Failed to load file."))
      }
    })
    reader.addEventListener("error", reject)
  })

const getImageFromSrc = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const mediaBtn = document.getElementById("btn-media")!

mediaBtn.addEventListener("click", () => {
  fileInput.click()
})

// Expose the canvas instance so end-to-end tests can assert on real state
// (active tool, elements, viewport, history).
;(globalThis as unknown as { adraw?: AdrawCanvas }).adraw = vanilla
