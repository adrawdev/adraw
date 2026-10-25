---
"@adraw/core": major
---

Replace the four public engine events (`change`, `viewportChange`, `toolChange`, `selectionChange`) with `AdrawStore` / `AdrawSnapshot`. `CanvasEngine` no longer exposes `on`/`off`/`emit` or `CanvasEventMap`; consumers read the current snapshot with `store.getSnapshot()` and subscribe with `store.subscribe()`. The DOM adapter and the store share one internal kind-carrying notifier. Snapshots copy changed slices, reuse unchanged ones, and include history availability, style, snapping, tool lock, overlay visibility and readiness. `AdrawStore` owns `isReady`/`onReady` and is disposed by each adapter.
