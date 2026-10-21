---
"@adraw/core": minor
---

Add engine-level history controls: `clearHistory()` resets undo/redo with the current state as the new baseline, `withoutHistory(fn)` suppresses checkpoints while running a callback, and `pushHistory()` is now public. `insertMedia()` accepts `{ history: false }`, and changes made outside history are folded into existing checkpoints so undo/redo preserves them. Loaded or programmatic documents no longer disappear or get reintroduced on `Ctrl+Z`.
