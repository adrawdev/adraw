import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ElementId,
  type ToolType,
  type ViewportState,
} from "@adraw/core"

export interface CanvasWebComponentsOptions extends CanvasOptions {}

/** Detail payloads for the `adraw:*` events re-dispatched from the element. */
export interface AdrawCanvasEventMap {
  "adraw:change": CustomEvent<{ elements: Map<ElementId, CanvasElement> }>
  "adraw:viewportchange": CustomEvent<{ viewport: ViewportState }>
  "adraw:toolchange": CustomEvent<{ tool: ToolType }>
  "adraw:selectionchange": CustomEvent<{ selectedIds: Set<ElementId> }>
}

/**
 * `<adraw-canvas>` custom element. Owns a single headless `AdrawCanvas`,
 * mounts it into an internal container on connect and tears it down on
 * disconnect. Mirrors core state onto public fields (`elements`, `viewport`,
 * `activeTool`, `selectedIds`) and re-dispatches core events as `adraw:*`
 * `CustomEvent`s so listeners can react to changes.
 */
export class AdrawCanvasElement extends HTMLElement {
  private instance: AdrawCanvas | null = null
  private container: HTMLDivElement | null = null

  /** Snapping / viewport config applied when the element next connects. */
  options?: CanvasWebComponentsOptions

  /** Latest mirrored core state. Read-only from the outside; updated on events. */
  elements = new Map<ElementId, CanvasElement>()
  viewport: ViewportState = { x: 0, y: 0, zoom: 1 }
  activeTool: ToolType = "select"
  selectedIds = new Set<ElementId>()

  /** The underlying core instance, or `null` while the element is disconnected. */
  get canvas(): AdrawCanvas | null {
    return this.instance
  }

  connectedCallback(): void {
    if (this.instance) {
      return
    }

    if (!this.style.display) {
      this.style.display = "block"
    }

    const container = document.createElement("div")
    container.style.cssText = "width: 100%; height: 100%"
    this.container = container
    this.appendChild(container)

    const instance = new AdrawCanvas({
      container,
      initialViewport: this.options?.initialViewport,
      isSnapMode: this.options?.isSnapMode,
      snapping: this.options?.snapping,
    })
    this.instance = instance

    instance.on<"change">(
      "change",
      ({ elements }: CanvasEventMap["change"]) => {
        this.elements = new Map(elements)
        this.dispatchEvent(
          new CustomEvent("adraw:change", {
            detail: { elements: this.elements },
          }),
        )
      },
    )

    instance.on<"viewportChange">(
      "viewportChange",
      ({ viewport }: CanvasEventMap["viewportChange"]) => {
        this.viewport = viewport
        this.dispatchEvent(
          new CustomEvent("adraw:viewportchange", { detail: { viewport } }),
        )
      },
    )

    instance.on<"toolChange">(
      "toolChange",
      ({ tool }: CanvasEventMap["toolChange"]) => {
        this.activeTool = tool
        this.dispatchEvent(
          new CustomEvent("adraw:toolchange", { detail: { tool } }),
        )
      },
    )

    instance.on<"selectionChange">(
      "selectionChange",
      ({ selectedIds }: CanvasEventMap["selectionChange"]) => {
        this.selectedIds = new Set(selectedIds)
        this.dispatchEvent(
          new CustomEvent("adraw:selectionchange", {
            detail: { selectedIds: this.selectedIds },
          }),
        )
      },
    )

    instance.render()
  }

  disconnectedCallback(): void {
    this.instance?.destroy()
    this.instance = null
    this.container?.remove()
    this.container = null
  }
}

/**
 * Register `AdrawCanvasElement` under a tag name (default `adraw-canvas`).
 * Safe to call multiple times — a name already defined is left untouched.
 */
export function defineAdrawCanvas(tagName = "adraw-canvas"): void {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, AdrawCanvasElement)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "adraw-canvas": AdrawCanvasElement
  }
}
