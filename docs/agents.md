# adraw agent guide

For coding agents and automation. adraw is a headless-first TypeScript canvas
engine; the DOM adapter is optional, and every editing operation is available
without a browser.

## Install

```bash
pnpm add @adraw/core
```

Zero runtime dependencies. For framework bindings, install `@adraw/react`,
`@adraw/vue`, `@adraw/svelte`, `@adraw/solid`, `@adraw/angular` or
`@adraw/web-components`.

## Headless quick start

```ts
import { AdrawCanvas, createRectangle } from "@adraw/core"

const canvas = new AdrawCanvas()

const rect = createRectangle({
  id: "rect-1",
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  cornerRadius: 8,
  strokeWidth: 2,
  strokeColor: "#111111",
  fillColor: "#ffd43b",
  rotation: 0,
  zIndex: 1,
  locked: false,
  visible: true,
})

canvas.addElement(rect)
console.log(canvas.getElements().size) // 1
```

`new AdrawCanvas()` stays headless. Pass `{ container }` to mount the SVG adapter
when a DOM is available.

## Observe state

```ts
import { AdrawStore } from "@adraw/core"

const store = new AdrawStore(canvas)
const unsubscribe = store.subscribe(() => {
  const snapshot = store.getSnapshot()
  console.log(snapshot.revision, snapshot.elements.size, snapshot.selectedIds)
})

// Later
unsubscribe()
store.dispose()
```

Snapshots are immutable and coherent. One completed canvas operation publishes at
most one snapshot. Do not mutate the maps or sets returned by
`getElements()` / `getSelectedIds()`; use the public methods.

## Update safely

```ts
canvas.updateElement("rect-1", { fillColor: "#ff8787" })
canvas.updateElements([
  { id: "rect-1", patch: { x: 40 } },
  { id: "text-1", patch: { text: "Hello" } },
])
```

More operations:

- `batch(fn, { history? })` — several mutations as one undo step and one
  publication. The callback must be synchronous.
- `setLocked(ids, locked)`, `setVisible(ids, visible)` and their `toggle*`
  variants.
- `duplicate(ids?, { offset? })`, `nudge(ids, delta)`, `align(ids, alignment)`,
  `distribute(ids, axis)`.
- `group()`, `ungroup()`, `bringToFront(ids)`, `sendToBack(ids)`,
  `setZIndex(id, z)`, `paste(point?)`.
- `undo()`, `redo()`, `withoutHistory(fn)`.

Use explicit ids for reproducible documents. `generateId()` is random; pass an
`id` to factories when you need stable output.

## Documents

```ts
import {
  DOCUMENT_VERSION,
  migrateDocument,
  serializeDocument,
  validateDocument,
} from "@adraw/core"

const doc = canvas.toDocument({ deterministic: true })
const json = serializeDocument(doc)

const parsed: unknown = JSON.parse(json)
const validation = validateDocument(parsed)
if (!validation.valid) {
  console.error(validation.issues) // { path, code, message, hint? }[]
}

const migrated = migrateDocument(parsed)
const restored = new AdrawCanvas({
  initialDocument: migrated,
  validateDocuments: true,
})

console.log(DOCUMENT_VERSION) // 1
console.log(restored.getElements().size)
```

- `toDocument({ deterministic: true })` sorts elements by `zIndex` then `id` and
  canonicalizes keys. Use `serializeDocument` for stable diffs.
- `validateDocument` never throws for malformed input; it returns issues with
  `path`, `code` and `message`.
- `migrateDocument` applies pure migrations and validates the result. It throws
  `AdrawError` with `unsupported-version` or `migration-missing` when there is no
  path.
- `loadDocument(doc, { validate: true })` validates on load; the default is off.
- The JSON Schema is `@adraw/core/schema.json` (draft 2020-12).

## Errors

```ts
import { AdrawError } from "@adraw/core"

try {
  canvas.updateElement("rect-1", { width: 0 })
} catch (error) {
  if (error instanceof AdrawError) {
    console.error(error.code, error.hint, error.details)
  }
}
```

Branch on `error.code`, not on message text. Common codes include
`invalid-field-type`, `invalid-field-value`, `invalid-reference`,
`derived-field`, `invalid-document`, `unsupported-version` and
`migration-missing`. `ADRAW_ERROR_CODES` exports the full list.

## Batches and history

```ts
canvas.withoutHistory(() => {
  canvas.loadDocument(doc)
})

canvas.batch(() => {
  canvas.updateElement("rect-1", { fillColor: "#ffd43b" })
  canvas.setLocked("rect-1", true)
})
```

`batch` records one checkpoint, publishes one snapshot and keeps partial work
undoable if the callback throws. It does not roll back. `{ history: false }`
folds changes into existing checkpoints.

## Export

Image export needs the DOM adapter:

```ts
const canvas = new AdrawCanvas({ container: document.querySelector("#app")! })
const blob = await canvas.toImage({ format: "png", scale: 2 })
```

Headless automation should serialize the document instead.

## Testing without a DOM

```ts
import { AdrawCanvas, createRectangle } from "@adraw/core"
import { describe, expect, it } from "vitest"

describe("diagram", () => {
  it("creates a rectangle", () => {
    const canvas = new AdrawCanvas()
    canvas.addElement(
      createRectangle({
        id: "rect",
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        cornerRadius: 0,
        strokeWidth: 2,
        strokeColor: "#111111",
        rotation: 0,
        zIndex: 1,
        locked: false,
        visible: true,
      }),
    )

    expect(canvas.getElements().has("rect")).toBe(true)
  })
})
```

Headless text measurement uses a deterministic approximation. Pass `measureText`
to the constructor for custom metrics, or set a measurer with
`setTextMeasurer()`.

## Discover the API

- [Public API inventory](PUBLIC_API.md) — the supported surface.
- [API stability policy](API_STABILITY.md) — versioning, deprecation and
  breaking-change rules.
- [Core guide](../packages/core/README.md) — tools, state, history, export.
- [Document schema](../packages/core/schema.json) — machine-readable contract.
- [Roadmap](ROADMAP.md) — what is planned.
- `llms.txt` at the repository root and `/llms.txt` on the docs site.

**Command API status:** a JSON command API (`applyCommands`) is a P1 roadmap item.
Until it ships, use the typed engine methods above and `batch()` for atomic
multi-step edits.

## Packages

| Package                 | Use                                                   |
| ----------------------- | ----------------------------------------------------- |
| `@adraw/core`           | Headless engine, DOM adapter, state and document APIs |
| `@adraw/react`          | React components and hooks                            |
| `@adraw/vue`            | Vue components and composables                        |
| `@adraw/svelte`         | Svelte components and composables                     |
| `@adraw/solid`          | Solid components and primitives                       |
| `@adraw/angular`        | Angular component, service and hooks                  |
| `@adraw/web-components` | `<adraw-canvas>` custom element                       |
