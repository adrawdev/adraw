---
"@adraw/core": minor
---

`toImage` gains an explicit `background` color (`background: "#fff"`, or `true` for `--adraw-background`) and an `exclude` element filter. Excluded elements are left out of both the drawing and the exported bounds. Export bounds are now computed from the exported content only: they follow z-order/visibility, include locked elements, account for rotation, and pad for stroke and arrowhead overhang so rotated shapes and horizontal lines/arrows are no longer clipped. `getElementBounds` now returns the correct axis-aligned bounds for rotated rectangles.
