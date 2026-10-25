---
"@adraw/core": minor
---

Add `isToolLocked`, a `CanvasOptions` flag that keeps the rectangle, ellipse, diamond, line, arrow, text and note tools active after they create an element instead of switching back to `select`. Created elements are left unselected. Toggle it at runtime with `setIsToolLocked()` and read it with `getIsToolLocked()`, or press `Q` while the canvas has focus. The draw and eraser tools already stay active, and text editing no longer forces the select tool while the option is enabled. With the lock on, clicking outside an open text or note editor commits it and starts the next element in the same click.
