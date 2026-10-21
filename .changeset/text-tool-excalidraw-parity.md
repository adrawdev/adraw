---
"@adraw/core": minor
"@adraw/react": minor
"@adraw/solid": minor
"@adraw/vue": minor
"@adraw/svelte": minor
"@adraw/angular": minor
"@adraw/web-components": minor
---

Bring the text tool closer to Excalidraw. `TextElement` gains optional
`fontFamily`, `textAlign`, `lineHeight` and `autoSize` fields (auto-sized by
default; fixed-width text wraps at its width). Text is now measured with an
injectable `TextMeasurer`: headless engines keep the deterministic character
approximation, `AdrawCanvas.mount` installs a canvas-backed measurer, and
`measureText` / `setTextMeasurer()` let hosts supply their own. The inline
editor matches the rendered font, line height, alignment, rotation and box, and
editing now follows Excalidraw semantics (`Enter` inserts a newline, `Escape`
and `Ctrl`/`Cmd+Enter` commit, `Enter`/`F2` or double-click edits a selected
text, and the text tool edits text under the pointer instead of stacking a new
element). Dragging a side resize handle switches text to fixed-width wrapping;
corners and vertical edges scale the font size. The default line height is now
`1.25` (previously `1.2`), so `measureTextSize()` and existing text element
heights change slightly. The text tool options and every adapter's
`useStyle("text")` expose the new fields.

Text elements can also be labels: `containerId` binds a label to a rectangle,
ellipse or arrow, and `labelPosition` places arrow labels along the line.
Double-clicking a shape or arrow (or clicking near a shape's center with the
text tool) creates a centered label. Shape labels wrap at the shape's inner
width but size their box to the longest wrapped line, so their inline editor
grows and shrinks both horizontally and vertically; `wrapWidth` stores the wrap
limit. Labels rotate and move with their container, grow it vertically when
needed, and are deleted with it. Labels are copied and pasted with their
container and follow its z-order. Dragging horizontally with the text tool
creates a fixed-width free text; dragging away from a shape's center creates
free text instead of a label. Text style changes applied to a selected labeled
shape are forwarded to its label. Arrow labels split the arrow shaft around
their box, so the line no longer crosses the text. Double-clicking empty canvas
now creates an auto-sized free text through the same editing path as the text
tool. Starting any text edit switches the active tool to `select` and clears
the selection so no resize handles are shown while typing; the text or its
container is selected again when the edit ends.
