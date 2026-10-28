---
"@adraw/core": major
---

Remove the unused public `CanvasState` interface. Public state observation goes through `AdrawStore` / `AdrawSnapshot`; adapter-specific reactive state types are unchanged. Internal: rename the arrow-binding module to `arrow-bindings.ts`.
