---
"@adraw/core": patch
---

Prevent native HTML5 drag-and-drop inside the canvas. Firefox could start dragging a shape when the select tool moved it, which cancelled the pointer gesture (`pointercancel`) and left the shape in place instead of following the pointer.
