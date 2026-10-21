import { afterNextRender, Component, ElementRef, inject } from "@angular/core"

import { CanvasService } from "./canvas.service"

// Renders the mount container and hands its host element to the nearest
// CanvasService once the DOM exists. The service (provided via provideCanvas()
// on an ancestor component) owns creation and teardown of the core canvas, so
// this component only wires up mounting.
@Component({
  selector: "adraw-canvas",
  styles: [":host { display: block; width: 100%; height: 100%; }"],
  template: "",
})
/**
 * `adraw-canvas` component. Mounts an `AdrawCanvas` into its host element on
 * next render; the `CanvasService` (provided via `provideCanvas()`) owns
 * creation and teardown.
 */
export class Canvas {
  private readonly canvas = inject(CanvasService)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)

  constructor() {
    afterNextRender(() => {
      this.canvas.mount(this.host.nativeElement)
    })
  }
}
