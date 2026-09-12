---
"@adraw/core": minor
---

Add an `arrow` tool and element type. Drag to draw a straight arrow with a filled head; drop either endpoint on a rectangle, ellipse, text, media or group to bind it. Bound endpoints aim at the target's center, are clipped just outside its border (with a `max(4, strokeWidth)` gap), and follow the target through moves, resizes and rotations. Moving/resizing an arrow directly detaches its bindings unless its targets move along in the same gesture; dragging an endpoint handle rebinds or unbinds it. Deleting a target detaches the arrow and freezes its last coordinates; hiding a target keeps the binding. Bindings survive copy/paste when the target is part of the copied batch (and are dropped otherwise). Public API adds the `arrow` `ToolType`, `ArrowElement`/`ArrowBinding` types and the `createArrow` factory; both arrowheads can be enabled via `startArrowhead`/`endArrowhead`.
