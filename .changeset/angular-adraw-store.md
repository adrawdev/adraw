---
"@adraw/angular": minor
---

Use `AdrawStore` for `CanvasService` state. The service exposes a `snapshot` signal and derives the existing readonly signals from it; history availability is snapshot-driven; `useSelection().elements` returns the selected elements; added `useStyle()`. `onReady` is owned by the store.
