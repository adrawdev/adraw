---
"@adraw/core": patch
---

Render element changes incrementally during `change` events: committed element DOM nodes are now cached by id and only rewritten when the element's geometry actually changed, instead of re-writing every node in the elements group. Dragging one element out of a board with many elements now updates just that element's node per frame, significantly reducing per-move rendering cost on element-heavy boards.
