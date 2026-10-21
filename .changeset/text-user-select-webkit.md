---
"@adraw/core": patch
---

Fix text selection handling in WebKit: SVG `<text>` elements now set the prefixed `-webkit-user-select: none` in addition to `user-select`, because WebKit ignores (and does not serialize) the unprefixed property on SVG text. This prevents accidental text selection while dragging or editing on the canvas.
