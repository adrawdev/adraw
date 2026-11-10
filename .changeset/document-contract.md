---
"@adraw/core": minor
---

Add a versioned document contract: `DOCUMENT_VERSION`, `validateDocument()` with path/code/message issues, `migrateDocument()` with a pure migration registry, and a draft 2020-12 JSON Schema published as `@adraw/core/schema.json`. Validation rejects duplicate ids, malformed fields, dangling group/binding/bound-text references, shared group children and group cycles. `CanvasOptions.validateDocuments` and `loadDocument(doc, { validate: true })` enable optional validation; the default remains off for compatibility. New `AdrawError` codes: `invalid-document`, `unsupported-version`, `migration-missing`.
