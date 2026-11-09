---
"@adraw/core": minor
---

Add `align(ids, alignment)` and `distribute(ids, axis)` for layout operations. `align` supports left/center/right/top/middle/bottom; `distribute` equalizes horizontal or vertical gaps while keeping the first and last targets fixed. Groups move as units, bound text follows its container, and locked or hidden elements are skipped. Arrow bindings to targets outside the moving set detach like a direct drag. Both methods record one history checkpoint and publish one snapshot.
