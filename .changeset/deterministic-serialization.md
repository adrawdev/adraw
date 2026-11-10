---
"@adraw/core": minor
---

Add deterministic document serialization: `toDocument({ deterministic: true })` and `toJSON({ deterministic: true })` sort elements by `zIndex` then `id` and canonicalize object key order, and `serializeDocument(doc)` always emits stable JSON. The default `toDocument()` keeps map insertion order until 1.0.
