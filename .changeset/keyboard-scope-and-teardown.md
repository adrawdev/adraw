---
"@adraw/core": minor
"@adraw/react": patch
"@adraw/solid": patch
"@adraw/svelte": patch
"@adraw/web-components": patch
---

Scope keyboard shortcuts to the focused canvas by default with a new `keyboard: "canvas" | "document" | "none"` option. The default is now `"canvas"` (previously shortcuts were handled document-wide); pass `keyboard: "document"` to restore the old behavior. The SVG is now focusable (`tabIndex`) and takes focus on pointer down, so shortcuts no longer fire while a form control or dialog has focus. `destroy()` now removes the keyboard listener and unsubscribes the adapter's engine event handlers, so unmounts and React StrictMode double-mounts no longer leave shortcuts alive or stack listeners. Adapters forward the new option.
