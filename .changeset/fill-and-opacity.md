---
"@adraw/core": minor
"@adraw/react": minor
"@adraw/solid": minor
"@adraw/vue": minor
"@adraw/svelte": minor
"@adraw/angular": minor
"@adraw/web-components": minor
---

Implement real fill and opacity styles. `RectangleElement` and `EllipseElement` now carry an optional `fillColor`, and every element carries an optional `opacity`; the renderer applies the fill to the shape and the opacity to the element's SVG group. `ToolOptions` gains `opacity` (default `1`), while `fillColor` now affects the rectangle and ellipse tools and restyles selected shapes, which makes translucent highlighter annotations possible. `CanvasElementStyle` is now the shared base of `ToolOptions` instead of an unused standalone type. Freehand paths remain unfilled.
