---
"@adraw/core": minor
---

Add z-order controls: `bringToFront(ids)`, `sendToBack(ids)`, `setZIndex(id, zIndex)` and a `zIndex` option for `insertMedia`. SVG nodes now render in ascending `zIndex` order, so programmatic restacking is reflected on screen.
