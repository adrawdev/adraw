---
"@adraw/core": minor
"@adraw/react": minor
"@adraw/solid": minor
"@adraw/vue": minor
"@adraw/svelte": minor
"@adraw/angular": minor
"@adraw/web-components": minor
---

Add per-tool style configuration. `CanvasOptions.tools` accepts defaults for `draw` (`strokeWidth`, `smoothing`, stroke color), `rectangle` (`cornerRadius`, `strokeWidth`), `text` (`fontSize`), and the ellipse/line/arrow strokes. `engine.getToolOptions(tool)` returns resolved defaults, `engine.setToolOptions(tool, partial)` updates future elements and restyles matching selected elements, and a new `toolOptionsChange` event reports resolved values. Rendering now updates stroke width and rectangle corner radius in place.

All adapters mirror the new state and event: React/Solid/Vue/Svelte/Angular add `useToolOptions()` and `useStyle(tool?)`; Web Components adds the `toolOptions` field, `getToolOptions()`/`setToolOptions()` methods and `adraw:tooloptionschange`. The React, Solid, Svelte and Web Components adapters now also forward all `CanvasOptions` (including `tools` and `clipboard`) to the core instance.
