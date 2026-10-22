import {
  AdrawCanvas,
  type CanvasElement,
  type CanvasEventMap,
  type CanvasOptions,
  type ElementId,
  type ToolType,
  type ViewportState,
} from "@adraw/core"

/**
 * Web Components-specific canvas options; currently an alias of
 * {@link CanvasOptions}.
 */
export interface CanvasWebComponentsOptions extends CanvasOptions {}

/** Detail payloads for the `adraw:*` events re-dispatched from the element. */
export interface AdrawCanvasEventMap {
  "adraw:change": CustomEvent<{ elements: Map<ElementId, CanvasElement> }>
  "adraw:viewportchange": CustomEvent<{ viewport: ViewportState }>
  "adraw:toolchange": CustomEvent<{ tool: ToolType }>
  "adraw:selectionchange": CustomEvent<{ selectedIds: Set<ElementId> }>
  "adraw:ready": CustomEvent<{ canvas: AdrawCanvas }>
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
  /** `true` while the element is connected and its engine is mounted. */
  isReady = false
  /** Optional callback invoked once after the engine mounts. */
  onReady?: (canvas: AdrawCanvas) => void

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
      ...this.options,
      container,
    })
    this.instance = instance
    instance.setHideOverlayWhileTransforming(
      this.options?.hideOverlayWhileTransforming ?? true,
    )
    this.elements = new Map(instance.getElements())
    this.viewport = instance.getViewport()
    this.activeTool = instance.getActiveTool()
    this.selectedIds = new Set(instance.getSelectedIds())

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

    this.isReady = true
    this.onReady?.(instance)
    this.dispatchEvent(
      new CustomEvent("adraw:ready", { detail: { canvas: instance } }),
    )
  }

  disconnectedCallback(): void {
    this.isReady = false
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
