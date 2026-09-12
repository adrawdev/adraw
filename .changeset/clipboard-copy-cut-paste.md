---
"@adraw/core": minor
---

Add clipboard support: `copy()`, `cut()`, and `paste()` on `AdrawCanvas`, plus `Ctrl/Cmd + C/X/V` shortcuts. Paste inserts fresh-ID clones centered on the current pointer (grouped children included, group references remapped) as a single undo step. `serializeClipboard()` / `deserializeClipboard()` bridge the in-memory buffer to the system clipboard, with custom `clipboard: { serialize, deserialize }` hooks.
