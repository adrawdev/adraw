---
"@adraw/core": minor
---

Add `CanvasEngine.setStyle()` and `CanvasEngine.getStyle()`. `setStyle` merges partial style options across every configurable tool: future elements use the new values and matching elements in the current selection are restyled immediately, with fields a tool does not support ignored for that tool. `getStyle` resolves the effective style in priority order — the selected elements' common style, then the active tool's options, then the global style. Export the `StyleOptions` type describing the accepted partial.
