---
"@adraw/core": minor
---

Add selection-only image export with `toImage({ selection: true })`. The export
uses the selected elements' bounds and content, expands selected groups to their
children, and includes bound text and arrow labels. Selected locked elements are
exported and hidden elements are skipped. An empty or fully hidden selection
produces a 1×1 image, matching the existing empty-canvas behavior. Background,
padding, scale, format, quality, dark mode and `exclude` keep working, and the
default export path is unchanged.
