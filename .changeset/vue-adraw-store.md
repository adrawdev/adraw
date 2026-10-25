---
"@adraw/vue": minor
---

Use `AdrawStore` for reactive state. `createCanvas()` now returns `store`, `snapshot` and `dispose`; `useHistory()` reads snapshot availability; `useSelection().elements` returns the selected elements; added `useStyle()`. `CanvasProvider` disposes the store on unmount.
