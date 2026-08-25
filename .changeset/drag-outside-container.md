---
"@adraw/core": minor
---

Add pointer capture on drag start so drawing, moving, resizing, and rotating keep working when the pointer leaves the container or the browser window. A cancelled pointer (e.g. an OS gesture taking over) now finalizes the in-progress tool action instead of leaving it stuck.
