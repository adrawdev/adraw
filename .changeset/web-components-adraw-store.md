---
"@adraw/web-components": minor
---

Use `AdrawStore` for mirrored state and keep the engine, store and document across disconnect/reconnect. Added `store`, `selectedElements`, `style`, `snapping`, `isSnapMode`, `isToolLocked`, `canUndo` and `canRedo` fields. `onReady`/`adraw:ready` still fire on every connect; `options` are applied when the engine is created on first connect.
