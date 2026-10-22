---
"@adraw/core": minor
---

Add `CanvasEngine.setStyle()` and `CanvasEngine.getStyle()`. `setStyle` merges partial style options globally: future elements use the new values and matching elements in the current selection are restyled immediately, with fields an element does not support ignored. `getStyle` returns the selected elements' common style, then the global style. Export the `StyleOptions` type and the `DEFAULT_STYLE` values.
