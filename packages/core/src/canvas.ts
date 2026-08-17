import {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  mountDom,
  type MountedDom,
} from "./dom/adapter"
import { renderAll } from "./dom/render"
import { toImage } from "./dom/to-image"
import { CanvasEngine } from "./engine/engine"
import {
  applyWheelTransform,
  dispatchPointerDownAt,
  dispatchPointerMoveAt,
  dispatchPointerUpAt,
} from "./engine/internal"
import type { AdrawCanvasOptions, ToImageOptions } from "./options"

export type {
  AdrawCanvasOptions,
  CanvasEventMap,
  CanvasOptions,
  MediaInput,
  ToImageOptions,
} from "./options"
export { createElementGroup, pointsToPath } from "./dom/svg"

// AdrawCanvas is the engine with a DOM adapter attached: all state/tools/
// history/events API is inherited from `CanvasEngine`; this class adds the
// mount lifecycle, DOM event wiring and rendering (see `dom/`).
export class AdrawCanvas extends CanvasEngine {
  private mounted: MountedDom | null = null

  constructor(options: AdrawCanvasOptions = {}) {
    super(options)

    if (options.container) {
      this.mount(options.container)
    }
  }

  handlePointerDown(
    screenX: number,
    screenY: number,
    event: PointerEvent,
  ): void {
    if (this.mounted) {
      handlePointerDown(this.mounted.state, this, screenX, screenY, event)
      return
    }
    dispatchPointerDownAt(this, screenX, screenY, event)
  }

  handlePointerMove(
    screenX: number,
    screenY: number,
    event: PointerEvent,
  ): void {
    if (this.mounted) {
      handlePointerMove(this.mounted.state, this, screenX, screenY, event)
      return
    }
    dispatchPointerMoveAt(this, screenX, screenY, event)
  }

  handlePointerUp(screenX: number, screenY: number, event: PointerEvent): void {
    if (this.mounted) {
      handlePointerUp(this.mounted.state, this, screenX, screenY, event)
      return
    }
    dispatchPointerUpAt(this, screenX, screenY, event)
  }

  handleWheel(event: WheelEvent, screenX?: number, screenY?: number): void {
    applyWheelTransform(this, event, screenX, screenY)
  }

  // ── DOM adapter ──

  // Attach the canvas to a DOM container, creating the SVG layers and wiring up
  // pointer/wheel/touch/keyboard events. Safe to call once; no-op if mounted.
  mount(container: HTMLElement): void {
    if (this.mounted) {
      return
    }
    this.mounted = mountDom(this, container)
    renderAll(this.mounted.state, this)
  }

  render(): void {
    if (this.mounted) {
      renderAll(this.mounted.state, this)
    }
  }

  destroy(): void {
    this.mounted?.destroy()
    this.mounted = null
  }

  async toImage(options: ToImageOptions = {}): Promise<Blob> {
    if (!this.mounted) {
      throw new Error("toImage requires a mounted canvas")
    }
    return toImage(this.mounted.state, this, options)
  }
}
