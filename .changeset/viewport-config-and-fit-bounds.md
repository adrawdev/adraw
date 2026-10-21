---
"@adraw/core": minor
"@adraw/react": minor
"@adraw/solid": minor
"@adraw/vue": minor
"@adraw/svelte": minor
"@adraw/angular": minor
"@adraw/web-components": minor
---

Add viewport configuration and bounds-aware fitting. `CanvasOptions.viewport` accepts `minZoom`, `maxZoom`, `zoomSensitivity`, `fitPadding` and `constrainToContent`; the engine now honors them for wheel zoom, `zoomIn`/`zoomOut`, `resetZoom`, `setViewport` and `zoomToFit` (previously those paths always used 0.1–10). The engine also exposes `getViewportConfig()`.

`zoomToFit({ padding?, bounds? })` now accepts an explicit padding and bounds, using `viewport.fitPadding` (32px) by default. Bounds can be either `{ x, y, width, height }` or `{ left, right, top, bottom }`; omitting them fits all visible elements. When bounds are supplied they also define the region used by `constrainToContent` until the next fit. With `constrainToContent: true`, panning is clamped so content stays in view and zooming out cannot go below the zoom of the last fit, so calling `zoomToFit()` after loading content keeps users from drifting away from it.

All adapters forward the new options and `zoomToFit(options)` arguments (React/Solid/Vue/Svelte `useViewport()`, the Angular `CanvasService`/`useViewport()`, and Web Components through `CanvasOptions`).
