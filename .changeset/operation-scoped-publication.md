---
"@adraw/core": patch
---

Scope internal state notifications to completed canvas operations. `AdrawStore` now publishes at most one coherent snapshot per public operation, including nested Scene, style, tool and event-handler changes, while no-ops remain silent. Nested calls fold into the outer operation; async `withoutHistory` publishes at its synchronous boundaries. Listener delivery is snapshot-isolated, failed operations flush their actual state before rethrowing, and the DOM adapter renders one deduplicated plan. Removes the unused `SceneChange.revision`.
