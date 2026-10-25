import {
  AdrawCanvas,
  AdrawStore,
  type AdrawSnapshot,
  type CanvasElement,
  type CanvasOptions,
  type ElementId,
  type SnappingConfig,
  type StyleOptions,
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
  "adraw:change": CustomEvent<{
    elements: ReadonlyMap<ElementId, CanvasElement>
  }>
  "adraw:viewportchange": CustomEvent<{ viewport: ViewportState }>
  "adraw:toolchange": CustomEvent<{ tool: ToolType }>
  "adraw:selectionchange": CustomEvent<{
    selectedIds: ReadonlySet<ElementId>
  }>
  "adraw:ready": CustomEvent<{ canvas: AdrawCanvas }>
}

/**
 * `<adraw-canvas>` custom element. Owns one headless `AdrawCanvas` and its
 * `AdrawStore`, mounts the engine into an internal container on connect and
 * tears down only the DOM adapter on disconnect. The document, history and
 * store survive reconnect. Mirrors the store snapshot onto public fields and
 * re-dispatches state changes as `adraw:*` `CustomEvent`s.
 */
export class AdrawCanvasElement extends HTMLElement {
  private instance: AdrawCanvas | null = null
  private adrawStore: AdrawStore | null = null
  private unsubscribe: (() => void) | null = null
  private container: HTMLDivElement | null = null
  private lastSnapshot: AdrawSnapshot | null = null

  /** Options applied when the element creates its engine on first connect. */
  options?: CanvasWebComponentsOptions

  /** Latest mirrored state. Read-only from the outside; updated by the store. */
  elements: ReadonlyMap<ElementId, CanvasElement> = new Map()
  selectedElements: readonly CanvasElement[] = []
  viewport: ViewportState = { x: 0, y: 0, zoom: 1 }
  activeTool: ToolType = "select"
  selectedIds: ReadonlySet<ElementId> = new Set()
  hideWhileTransforming = false
  style: StyleOptions = {}
  snapping: SnappingConfig = { threshold: 5 }
  isSnapMode = false
  isToolLocked = false
  canUndo = false
  canRedo = false
  /** `true` while the element is connected and its engine is mounted. */
  isReady = false
  /** Optional callback invoked on every successful connect. */
  onReady?: (canvas: AdrawCanvas) => void

  /** The underlying core instance, or `null` before the first connect. */
  get canvas(): AdrawCanvas | null {
    return this.instance
  }

  /** The store backing the mirrored fields, or `null` before first connect. */
  get store(): AdrawStore | null {
    return this.adrawStore
  }

  connectedCallback(): void {
    if (this.container) {
      return
    }
    if (!this.style.display) {
      this.style.display = "block"
    }

    if (!this.instance) {
      const instance = new AdrawCanvas(this.options)
      instance.setHideOverlayWhileTransforming(
        this.options?.hideOverlayWhileTransforming ?? true,
      )
      const store = new AdrawStore(instance)
      this.instance = instance
      this.adrawStore = store
      this.lastSnapshot = store.getSnapshot()
      this.syncFromSnapshot(true)
      this.unsubscribe = store.subscribe(() => {
        this.syncFromSnapshot()
      })
    }

    const instance = this.instance
    if (!instance) {
      return
    }

    const container = document.createElement("div")
    container.style.cssText = "width: 100%; height: 100%"
    this.container = container
    this.appendChild(container)

    instance.mount(container)
    this.syncFromSnapshot(true)
    this.onReady?.(instance)
    this.dispatchEvent(
      new CustomEvent("adraw:ready", { detail: { canvas: instance } }),
    )
  }

  disconnectedCallback(): void {
    this.instance?.destroy()
    this.container?.remove()
    this.container = null
  }

  private syncFromSnapshot(initial = false): void {
    const store = this.adrawStore
    if (!store) {
      return
    }
    const next = store.getSnapshot()
    const previous = this.lastSnapshot
    this.lastSnapshot = next

    this.elements = next.elements
    this.selectedElements = next.selectedElements
    this.viewport = next.viewport
    this.activeTool = next.tool
    this.selectedIds = next.selectedIds
    this.hideWhileTransforming = next.hideWhileTransforming
    this.style = next.style
    this.snapping = next.snapping
    this.isSnapMode = next.isSnapMode
    this.isToolLocked = next.isToolLocked
    this.canUndo = next.canUndo
    this.canRedo = next.canRedo
    this.isReady = next.isReady

    if (initial || !previous) {
      return
    }
    if (previous.elements !== next.elements) {
      this.dispatchEvent(
        new CustomEvent("adraw:change", {
          detail: { elements: next.elements },
        }),
      )
    }
    if (previous.viewport !== next.viewport) {
      this.dispatchEvent(
        new CustomEvent("adraw:viewportchange", {
          detail: { viewport: next.viewport },
        }),
      )
    }
    if (previous.tool !== next.tool) {
      this.dispatchEvent(
        new CustomEvent("adraw:toolchange", {
          detail: { tool: next.tool },
        }),
      )
    }
    if (previous.selectedIds !== next.selectedIds) {
      this.dispatchEvent(
        new CustomEvent("adraw:selectionchange", {
          detail: { selectedIds: next.selectedIds },
        }),
      )
    }
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
