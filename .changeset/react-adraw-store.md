---
"@adraw/react": minor
---

Use `AdrawStore` for provider state and subscriptions. `useCanvas()` now exposes `store` and `snapshot`; `useHistory()` reads snapshot availability; `useSelection().elements` returns the selected elements; added `useStyle()`. `setOptions` rebuilds the engine and store only for constructor-only options.
