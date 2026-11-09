---
"@adraw/core": minor
---

Add `batch(fn, { history })` to group multiple canvas mutations into one undo step and one store publication. Nested batches join the outer batch, explicit checkpoints inside the callback are suppressed, `{ history: false }` folds changes into existing checkpoints, and a throwing callback keeps partial work undoable without rollback.
