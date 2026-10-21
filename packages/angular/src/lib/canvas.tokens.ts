import type { AdrawCanvas, CanvasOptions } from "@adraw/core"
import { InjectionToken } from "@angular/core"

// Kept as its own interface (even though it adds nothing yet) so app code and
// provideCanvas() have a stable, framework-named options type — mirrors the
// CanvasReactOptions / CanvasVueOptions / CanvasSolidOptions in the other
// adapters.
/**
 * Angular-specific canvas options.
 *
 * Extends the core options with `onReady`, invoked once after
 * `<adraw-canvas>` mounts the engine.
 */
export interface CanvasAngularOptions extends CanvasOptions {
  /** Called once after the engine is mounted. */
  onReady?: (engine: AdrawCanvas) => void
}

// Optional DI token read by CanvasService's constructor. provideCanvas() only
// registers it when options are passed, so the service falls back to defaults
// when the token is absent (injected with { optional: true }).
/**
 * Optional DI token read by `CanvasService`'s constructor. `provideCanvas()`
 * registers it only when options are passed, falling back to defaults.
 */
export const CANVAS_OPTIONS = new InjectionToken<CanvasAngularOptions>(
  "adraw-canvas-options",
)
