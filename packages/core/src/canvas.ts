import {
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  mountDom,
  type MountedDom,
} from "./dom/adapter"
import { renderAll } from "./dom/render"
import { reconcileElements } from "./dom/render/elements"
import { createCanvasTextMeasurer } from "./dom/text-measure"
import { toImage } from "./dom/to-image"
import { CanvasEngine } from "./engine/engine"
import {
  applyWheelTransform,
  dispatchPointerDownAt,
  dispatchPointerMoveAt,
  dispatchPointerUpAt,
} from "./engine/internal"
import { notifyState } from "./engine/state-notifier"
import type { AdrawCanvasOptions, ToImageOptions } from "./options"

export type {
  AdrawCanvasOptions,
  CanvasOptions,
  ClipboardOptions,
  KeyboardScope,
  MediaInput,
  ToImageOptions,
} from "./options"
export { createElementGroup, pointsToPath } from "./dom/svg"

// AdrawCanvas is the engine with a DOM adapter attached: all state/tools/
// history API is inherited from `CanvasEngine`; this class adds the mount
// lifecycle, DOM event wiring and rendering (see `dom/`).
/**
 * Canvas engine with a DOM adapter attached. State, tools and history are
 * inherited from {@link CanvasEngine}; this class adds the mount lifecycle,
 * DOM event handling and rendering (see `dom/`).
 *
 * Construct with `new AdrawCanvas({ container })` to mount immediately, or
 * with no arguments and call `mount(container)` later to run headless.
 */
export class AdrawCanvas extends CanvasEngine {
  private mounted: MountedDom | null = null

  constructor(options: AdrawCanvasOptions = {}) {
    super(options)

    if (options.container) {
      this.mount(options.container)
    }
  }

  /**
   * Dispatch a pointer-down event in screen coordinates.
   * @param screenX Screen x coordinate.
   * @param screenY Screen y coordinate.
   * @param event Underlying pointer event.
   */
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

  /**
   * Dispatch a pointer-move event in screen coordinates.
   * @param screenX Screen x coordinate.
   * @param screenY Screen y coordinate.
   * @param event Underlying pointer event.
   */
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

  /**
   * Dispatch a pointer-up event in screen coordinates.
   * @param screenX Screen x coordinate.
   * @param screenY Screen y coordinate.
   * @param event Underlying pointer event.
   */
  handlePointerUp(screenX: number, screenY: number, event: PointerEvent): void {
    if (this.mounted) {
      handlePointerUp(this.mounted.state, this, screenX, screenY, event)
      return
    }
    dispatchPointerUpAt(this, screenX, screenY, event)
  }

  /**
   * Dispatch a wheel event (pan/zoom).
   *
   * @param event Underlying wheel event.
   * @param screenX Optional screen x of the cursor.
   * @param screenY Optional screen y of the cursor.
   */
  handleWheel(event: WheelEvent, screenX?: number, screenY?: number): void {
    applyWheelTransform(this, event, screenX, screenY)
  }

  // ── DOM adapter ──

  // Attach the canvas to a DOM container, creating the SVG layers and wiring up
  // pointer/wheel/touch/keyboard events. Safe to call once; no-op if mounted.
  /**
   * Attach the canvas to a DOM container, creating the SVG layers and wiring
   * up pointer/wheel/touch/keyboard events. Safe to call once; no-op if
   * already mounted.
   *
   * @param container Element that will host the SVG.
   */
  mount(container: HTMLElement): void {
    if (this.mounted) {
      return
    }
    if (this.usesDefaultTextMeasurer()) {
      this.setAdapterTextMeasurer(
        createCanvasTextMeasurer(container.ownerDocument),
      )
    }
    this.mounted = mountDom(this, container)
    // Initial content lives in the engine before the adapter exists; build its
    // nodes before the full render so a mounted canvas with `initialElements`
    // or `initialDocument` is not blank until the first change.
    reconcileElements(this.mounted.state, this)
    renderAll(this.mounted.state, this)

    // Web fonts can change text metrics after the first paint. Re-measure once
    // they are ready so boxes and wrapping match the glyphs.
    const fonts = container.ownerDocument.fonts
    if (fonts) {
      void fonts.ready.then(() => {
        if (this.mounted) {
          this.refreshTextMetrics()
        }
      })
    }
    notifyState(this, "mount")
  }

  /**
   * Whether the canvas is currently mounted into a DOM container.
   */
  isMounted(): boolean {
    return this.mounted !== null
  }

  /**
   * Full re-render of the SVG layers.
   */
  render(): void {
    if (this.mounted) {
      renderAll(this.mounted.state, this)
    }
  }

  /**
   * Tear down the DOM adapter, removing the SVG and event listeners.
   */
  destroy(): void {
    const wasMounted = this.mounted !== null
    this.mounted?.destroy()
    this.mounted = null
    if (wasMounted) {
      notifyState(this, "mount")
    }
    this.resetTextMeasurer()
  }

  /**
   * Export the canvas to an image blob.
   *
   * @param options Image export options.
   * @throws When the canvas is not mounted.
   */
  async toImage(options: ToImageOptions = {}): Promise<Blob> {
    if (!this.mounted) {
      throw new Error("toImage requires a mounted canvas")
    }
    return toImage(this.mounted.state, this, options)
  }
}
