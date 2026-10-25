---
"@adraw/solid": minor
---

Use `AdrawStore` for reactive state. The context now exposes `store` and `snapshot`; history availability comes from the snapshot; `useSelection().elements` returns the selected elements; added `useStyle()`. The provider cleanup disposes the store.
