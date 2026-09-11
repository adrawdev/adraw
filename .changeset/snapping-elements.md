---
"@adraw/core": minor
"@adraw/react": patch
"@adraw/solid": patch
"@adraw/svelte": patch
"@adraw/web-components": patch
---

Snap elements to other elements' edges and centers while moving, resizing or drawing. Snapping activates while holding Ctrl/Cmd, or by default with the new `isSnapMode` option; alignment guides are rendered while snapped.

**Breaking:** `snapping.enabled` was removed. Snapping is always available and gated per gesture by Ctrl/Cmd or `isSnapMode`; `SnappingConfig` is now `{ threshold }`.
