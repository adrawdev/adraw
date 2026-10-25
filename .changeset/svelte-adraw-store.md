---
"@adraw/svelte": minor
---

Use `AdrawStore` for reactive state. The context now exposes `store`, `snapshot` and `dispose`; `useHistory()` reads snapshot availability (making `canUndo`/`canRedo` reactive); `useSelection().elements` returns the selected elements; added `useStyle()`. `CanvasProvider` disposes the store on destroy.
