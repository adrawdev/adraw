---
"@adraw/core": minor
"@adraw/vue": minor
"@adraw/solid": minor
"@adraw/svelte": minor
"@adraw/angular": minor
"@adraw/web-components": minor
---

Add `initialElements` / `initialDocument` to core constructor options. Initial content is cloned, resolves arrow bindings, and becomes the history baseline so the first undo does not remove it.

Vue, Solid and Svelte providers now create the engine headlessly and only mount it in `<Canvas>`; Angular and Web Components already did. They all gain `onReady(engine)` (or `adraw:ready` / `isReady` for Web Components) and a reactive readiness flag, and Vue/Solid/Svelte/Angular expose `useCanvasEngine()` returning `{ engine, isReady }`.
