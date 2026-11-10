# Roadmap

**Status:** draft · **Last updated:** 2026-11-07 · **Current core:** 0.5.0

adraw is a headless-first canvas engine, not a whiteboard application. This
roadmap prioritizes the primitives that make it small, predictable and pleasant
to embed, script and extend. Product-level features — UI chrome, collaboration,
embeds, AI — are deliberately kept out of core and tracked as optional ecosystem
packages.

## 1. Thesis

**Make adraw the lightest way to put a serious infinite canvas inside a product
— for humans and agents.**

What "lightweight and intuitive" means here:

- **Lightweight:** zero runtime dependencies, ≤ 45 KB gzip for core,
  tree-shakable, optional features in separate packages.
- **Intuitive for developers:** one way to observe state, one document format,
  one style API, one tool contract, consistent options and return values.
- **Intuitive for agents:** every mutation is expressible as a validated,
  serializable command; documents round-trip; capabilities are discoverable.
- **Engine, not app:** core ships primitives; UI, collaboration, embeds and AI
  are examples or optional packages.

## 2. How we score

**Impact**

| Score | Meaning                                 |
| ----- | --------------------------------------- |
| 5     | Unlocks adoption or a central use case. |
| 4     | Major improvement for most users.       |
| 3     | Clear improvement for a segment.        |
| 2     | Nice to have.                           |
| 1     | Marginal.                               |

**Effort**

| Score | Meaning            |
| ----- | ------------------ |
| S     | ≤ 1 week           |
| M     | 2–4 weeks          |
| L     | 1–2 months         |
| XL    | More than 2 months |

**Priority**

| Score | Meaning                                        |
| ----- | ---------------------------------------------- |
| P0    | Do now; blocks the "lightweight engine" story. |
| P1    | Next; closes the gap for real products.        |
| P2    | Scale/extensibility; after P0 and P1.          |
| P3    | Ecosystem or optional package; not core.       |

## 3. At a glance

| Milestone | Theme                  | Main outcome                                                                                  |
| --------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| 0.6       | Contracts & quick wins | Public editing APIs, deterministic documents, grid, export/clipboard basics, docs.            |
| 0.7       | Agent-ready            | Command API, JSON Schema/validation/migrations, capability introspection, persistence recipe. |
| 0.8       | Diagramming primitives | Stroke styles, arrowheads, curved/elbow arrows, image crop, culling/spatial index, theme.     |
| 0.9       | Scale & extension      | Custom shapes/tools, frames, multi-point arrows, benchmarks, accessibility baseline.          |
| 1.0       | Stable                 | API freeze, migration guide, bundle/performance budgets, complete docs.                       |
| Post-1.0  | Ecosystem              | Collaboration, comments, presence, UI kit, embeds, rich text, hand-drawn, converters, MCP.    |

## 4. Workstreams

### 4.1 API and developer experience

Goal: every supported edit has a documented, consistent method; no consumer
needs to mutate internal maps.

| Initiative                                              | Why                                                                                    | Impact | Effort | Priority |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ | ------ | -------- |
| Partial update APIs (`updateElement`, `updateElements`) | Today only `addElement` and wholesale `setElements` exist.                             | 5      | M      | P0       |
| Lock/hide API (`setLocked`, `setVisible`)               | `locked`/`visible` exist and hit-testing respects them, but there is no public setter. | 4      | S      | P0       |
| Batch/transaction (`batch(fn)`, one checkpoint)         | Multi-step edits can record several history checkpoints.                               | 4      | M      | P0       |
| Duplicate, nudge and zoom shortcuts                     | `Ctrl/Cmd+D`, arrow-key nudge and `Ctrl/Cmd +/-/0` are missing.                        | 4      | S      | P0       |
| Align/distribute                                        | Expected for diagramming; currently manual.                                            | 4      | S–M    | P0       |
| One-step z-order (`bringForward`, `sendBackward`)       | Only front/back exist.                                                                 | 3      | S      | P1       |
| Structured errors (`AdrawError` with code and hint)     | Makes failures actionable for developers and agents.                                   | 3      | S      | P0       |
| API stability policy (semver, deprecation, changesets)  | Pre-1.0 churn is a adoption risk.                                                      | 5      | S      | P0       |
| Public API type tests                                   | Prevent silent breaking changes in exported types.                                     | 4      | M      | P1       |

Notes:

- `updateElement` must validate type-specific fields and re-run binding and group
  synchronization.
- `batch` should record one checkpoint and rely on operation scoping for one
  state publication.
- Do not add a second observation API. `AdrawStore` remains the only public
  observation seam.

### 4.2 Agent surface

Goal: an agent can discover, generate, validate, edit and export a document
without guessing.

| Initiative                                                              | Why                                                               | Impact | Effort | Priority |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------- | ------ | ------ | -------- |
| JSON Schema for `CanvasDocument`                                        | Agents need a machine-readable contract.                          | 5      | M      | P0       |
| `validateDocument` with structured issues                               | Loading untrusted documents must fail safely and explainably.     | 5      | M      | P0       |
| `migrateDocument` plus versioned fixtures                               | `CanvasDocument.version` exists but there is no migration path.   | 5      | M      | P0       |
| Deterministic serialization (`toDocument({ deterministic: true })`)     | Stable diffs and reproducible agent output.                       | 5      | S      | P0       |
| `applyCommands` (add/update/remove/select/style/viewport/group/reorder) | One atomic, JSON-serializable mutation path.                      | 5      | M–L    | P1       |
| `getCapabilities()`                                                     | Reports tools, element types, style fields, commands and formats. | 4      | S      | P1       |
| Agent guide and `llms.txt`                                              | Optimize docs for coding agents, not only humans.                 | 5      | S–M    | P0       |
| Agent eval suite                                                        | Prove generate → validate → load → edit → export round-trips.     | 4      | M      | P1       |
| MCP server package (optional)                                           | Bridge canvas commands to agent tooling.                          | 4      | M      | P2       |

Notes:

- Commands are plain JSON, validated before applying, atomic per call, with one
  history step and one publication.
- No agent-specific core paths: commands are a thin facade over the public API.
- Publish the document schema as a standalone `schema.json` in the package.

### 4.3 Editing primitives

Goal: cover the diagramming primitives developers expect, without turning core
into an application.

| Initiative                                                                     | Why                                                                             | Impact | Effort | Priority |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------ | ------ | -------- |
| Grid rendering and snap to grid                                                | `gridEnabled`/`gridSize` already exist in `CanvasConfig` but are unused.        | 4      | S–M    | P0       |
| Stroke styles (`solid`, `dashed`, `dotted`)                                    | Every diagramming tool supports them; currently solid only.                     | 4      | M      | P1       |
| Arrowhead types (`arrow`, `bar`, `dot`, `diamond`)                             | Today arrowheads are booleans for a filled triangle.                            | 4      | M      | P1       |
| Curved and elbow arrows                                                        | Today arrows are straight two-point segments.                                   | 4      | L      | P1       |
| Image crop and aspect-ratio lock                                               | Images can be moved and resized but not cropped.                                | 3      | M      | P1       |
| Multi-point lines and arrows                                                   | Requires editable bend points and updated hit-testing.                          | 3      | L      | P2       |
| Group resize and rotation ([#22](https://github.com/adrawdev/adraw/issues/22)) | Group bounds are derived; `width`/`height`/`rotation` patches currently reject. | 4      | L      | P2       |
| Frames (clip, label, export bounds)                                            | Useful primitive between groups and pages.                                      | 3      | L      | P2       |
| Lasso selection                                                                | Marquee exists; lasso is a product-level convenience.                           | 2      | M      | P3       |
| Highlighter (style preset or tool)                                             | Can be expressed with opacity/fill today.                                       | 2      | S      | P3       |
| Hand-drawn/rough renderer                                                      | Excalidraw differentiator, not an engine requirement.                           | 3      | L      | P3       |
| Fill patterns (hachure, cross-hatch)                                           | Optional visual fidelity; solid fill is enough for most embeds.                 | 3      | M      | P3       |
| Rich text                                                                      | Heavy model change; better as an optional package.                              | 3      | XL     | P3       |
| Embeds, bookmarks and video                                                    | Product-level content; keep core media raster-only.                             | 3      | L      | P3       |
| Multi-page documents                                                           | App-level; one canvas per document is the engine contract.                      | 2      | M      | P3       |

Notes:

- Stroke and arrowhead types are style extensions, not new tools.
- Keep `startArrowhead`/`endArrowhead` backward compatible: accept boolean or
  enum, migrate `true` to `"arrow"` and `false` to `"none"`.
- Arrow routing must update bindings, bound-text placement, hit-testing and
  export together.

### 4.4 Document and interoperability

Goal: documents are portable, versioned and safe to load from untrusted sources.

| Initiative                                        | Why                                                              | Impact | Effort | Priority |
| ------------------------------------------------- | ---------------------------------------------------------------- | ------ | ------ | -------- |
| System clipboard integration                      | Hooks exist, but the DOM adapter does not handle `copy`/`paste`. | 4      | M      | P0       |
| File drop and image paste in the DOM adapter      | Examples wire this manually; it should be built in.              | 4      | M      | P0       |
| Export selection (`toImage({ selection: true })`) | Currently only possible through an `exclude` predicate.          | 4      | S      | P0       |
| Copy selection as image                           | Common expectation from tldraw and Excalidraw.                   | 3      | S–M    | P1       |
| Persistence adapter interface and recipes         | No official save/load/autosave story.                            | 4      | M      | P1       |
| Asset store interface                             | Media currently embeds data URLs, which bloats documents.        | 3      | M      | P2       |
| PDF export (optional package)                     | Useful, but not worth a core dependency.                         | 2      | M      | P3       |
| Excalidraw/tldraw converters (optional packages)  | Adoption path for existing documents.                            | 3      | L      | P3       |

Notes:

- Clipboard payload should include `text/plain` JSON and
  `application/x-adraw+json`; images as PNG.
- Validation must reject dangling group or binding references, duplicate IDs,
  non-finite numbers and invalid versions.
- Migrations must be pure functions with fixtures from every shipped version.

### 4.5 Extensibility

Goal: a third party can add a shape or tool without forking core.

| Initiative                                 | Why                                                          | Impact | Effort | Priority |
| ------------------------------------------ | ------------------------------------------------------------ | ------ | ------ | -------- |
| Custom shape registry (`registerShape`)    | `ElementType` is a closed union; tldraw's biggest advantage. | 5      | L      | P1–P2    |
| Custom tool registry (`registerTool`)      | Tools are registered in the engine constructor.              | 4      | L      | P2       |
| Renderer override seam for the DOM adapter | Enables custom SVG rendering without replacing the adapter.  | 3      | M      | P2       |
| Plugin lifecycle                           | Only worth adding once shapes and tools are stable.          | 2      | M      | P3       |

Notes:

- Minimal shape contract: `type`, `create`, `getBounds`, `hitTest`, `render`,
  optional `serialize`/`migrate`.
- Keep custom shapes tree-shakable and out of core's fixed `ElementType` union
  where possible.
- One reference package (for example a `star` or `sticky-arrow` shape) proves the
  API before it is declared stable.

### 4.6 Performance and weight

Goal: stay fast enough for generated boards and small enough to embed anywhere.

| Initiative                                          | Why                                                   | Impact | Effort | Priority |
| --------------------------------------------------- | ----------------------------------------------------- | ------ | ------ | -------- |
| Bundle budget in CI                                 | Baseline is 42.2 KB gzip; enforce a 45 KB ceiling.    | 4      | S      | P0       |
| `sideEffects: false` and export/tree-shaking audit  | Keep the package friendly to bundlers.                | 4      | S      | P0       |
| Viewport culling in the DOM adapter                 | Every element gets a DOM node today.                  | 5      | M      | P1       |
| Spatial index for hit-testing, marquee and snapping | Current scans are linear.                             | 4      | M      | P1       |
| Benchmarks (1k/10k elements)                        | No published performance contract.                    | 4      | M      | P1       |
| Text measurement cache                              | Re-measuring unchanged text is avoidable.             | 2      | S      | P2       |
| History memory strategy                             | Each checkpoint copies the element map and selection. | 3      | L      | P2       |
| Optional canvas renderer exploration                | Only if SVG cannot meet the 10k-element target.       | 3      | XL     | P3       |

Notes:

- Measure before optimizing; publish benchmark numbers in the repository.
- Keep zero runtime dependencies; heavy features go to optional packages.
- Culling must never drop selected, temporary or overlay elements.

### 4.7 Documentation and community

Goal: docs are the product surface for developers and agents.

| Initiative                                     | Why                                                      | Impact | Effort | Priority |
| ---------------------------------------------- | -------------------------------------------------------- | ------ | ------ | -------- |
| Generated API reference from JSDoc             | JSDoc is mandatory; the reference should be generated.   | 5      | M      | P0       |
| `llms.txt` and agent guide                     | Coding agents need a compact, authoritative entry point. | 5      | S–M    | P0       |
| "Why adraw" and comparison page                | Explains the lightweight/headless positioning.           | 4      | S      | P0       |
| Recipes (persistence, custom shapes, headless) | Examples exist, but not task-oriented guides.            | 4      | M      | P1       |
| Migration guides per minor                     | Required for a stable pre-1.0 and 1.x story.             | 4      | S      | P0       |
| Playground with shareable examples             | Lowers time to first canvas.                             | 3      | S–M    | P1       |
| Versioned docs                                 | Only needed once the API stabilizes.                     | 3      | M      | P2       |

Notes:

- Every public export already requires JSDoc; make the reference generated, not
  hand-maintained.
- The agent guide should be copy-pasteable and cover commands, schema and
  round-trip examples.

### 4.8 Quality and accessibility

Goal: confidence without a heavy test matrix.

| Initiative                                     | Why                                                  | Impact | Effort | Priority |
| ---------------------------------------------- | ---------------------------------------------------- | ------ | ------ | -------- |
| Type tests for the public API                  | Catch accidental type breaks.                        | 4      | M      | P1       |
| Property-based tests (round-trip, transforms)  | Bindings, groups and documents have many edge cases. | 3      | M      | P1       |
| Visual regression for shapes, arrows and text  | SVG rendering is the product.                        | 3      | M      | P1       |
| Accessibility baseline (`role`, labels, focus) | Embedders need a keyboard/ARIA starting point.       | 3      | M      | P1–P2    |
| Structured errors with remediation hints       | Same as 4.1; counted once in delivery.               | 3      | S      | P0       |
| Browser matrix (Chromium, Firefox, WebKit)     | Already partly covered by Playwright.                | 3      | S      | P1       |

Notes:

- Full screen-reader editing is out of scope; a canvas needs a keyboard and ARIA
  baseline, not a full document editor.
- Keep the e2e suite as the contract for gestures.

### 4.9 Ecosystem packages (not core)

Goal: ship product-level features without bloating the engine.

| Package / initiative                                 | Why                                                       | Impact | Effort | Priority |
| ---------------------------------------------------- | --------------------------------------------------------- | ------ | ------ | -------- |
| `@adraw/persist` (localStorage, IndexedDB adapters)  | Gives developers a save/load story without core changes.  | 4      | M      | P1       |
| `@adraw/assets` (asset store)                        | Keeps documents small by externalizing media.             | 3      | M      | P2       |
| `@adraw/mcp` (agent bridge)                          | Natural distribution channel for agent workflows.         | 4      | M      | P2       |
| `@adraw/collab` (sync, presence, comments)           | Large, backend-dependent; not a core concern.             | 5      | XL     | P3       |
| `@adraw/ui` (toolbar, style panel, context menu)     | tldraw/Excalidraw parity without forcing UI on embedders. | 4      | L      | P3       |
| `@adraw/embeds` (bookmark, video, iframe)            | Product-level content.                                    | 3      | L      | P3       |
| `@adraw/rich-text`                                   | Rich text is a model change, not a style option.          | 3      | XL     | P3       |
| `@adraw/rough` (hand-drawn renderer)                 | Excalidraw-style visual fidelity.                         | 3      | L      | P3       |
| `@adraw/export-pdf`                                  | Heavy dependency; optional by design.                     | 2      | M      | P3       |
| `@adraw/convert-excalidraw`, `@adraw/convert-tldraw` | Import path for existing users.                           | 3      | L      | P3       |

Notes:

- Each package must be optional, independently versioned and tree-shakable.
- Core must not import from ecosystem packages.

## 5. Milestones and exit criteria

### 0.6 — Contracts and quick wins (target: 4–6 weeks)

Tracking issue: [#21](https://github.com/adrawdev/adraw/issues/21).

Scope: 4.1 P0, 4.2 schema/validation/deterministic serialization, 4.3 grid,
4.4 clipboard/drop/export selection, 4.6 bundle budget, 4.7 API reference and
agent guide.

Exit criteria:

- Every supported edit has a public method; no consumer mutates internal maps.
- `toDocument()` is deterministic; `validateDocument` and `migrateDocument`
  exist with fixtures.
- Grid renders and snaps.
- Copy/paste and image drop work in the DOM adapter.
- API reference is generated and the agent guide is published.
- Core is ≤ 45 KB gzip with zero runtime dependencies.

### 0.7 — Agent-ready (target: 6–8 weeks)

Scope: 4.2 command API, capabilities and eval suite; 4.4 persistence adapter;
4.5 shape registry spike; 4.8 type and property tests.

Exit criteria:

- `applyCommands` covers every public mutation and is atomic per call.
- Commands are JSON-serializable and validated before applying.
- An agent eval suite passes: generate → validate → load → edit → export.
- Persistence works with localStorage and IndexedDB recipes.
- Shape registry RFC accepted with a reference implementation.

### 0.8 — Diagramming primitives (target: 8–10 weeks)

Scope: 4.3 stroke styles, arrowheads, routing and image crop; 4.6 culling,
spatial index and benchmarks; 4.1 one-step z-order; theme API.

Exit criteria:

- Dashed/dotted strokes and arrowhead types render, hit-test and export
  correctly.
- Curved/elbow arrows keep bindings and bound text aligned.
- 1k elements pan/zoom at 60fps; 10k elements are usable with culling;
  hit-testing stays under 5ms at 10k.
- Benchmark results are published in the repository.

### 0.9 — Scale and extension (target: 10–12 weeks)

Scope: 4.5 custom shapes and tools; 4.3 frames and multi-point arrows; 4.8
accessibility; 4.7 recipes and playground.

Exit criteria:

- A third-party shape package works without patching core.
- A third-party tool package works without patching core.
- Keyboard and ARIA baseline is documented and tested.
- Core stays within the 1.0 bundle budget.

### 1.0 — Stable (target: after 0.9)

Scope: API freeze, migration guide, complete docs, enforced performance and
bundle budgets, accessibility baseline.

Exit criteria:

- Semver policy and deprecation process are published.
- All public APIs are documented and covered by type tests.
- No breaking changes without a major release.
- Core is ≤ 45 KB gzip with zero runtime dependencies.

### Post-1.0 — Ecosystem

Scope: collaboration, comments/presence/version history, UI kit, embeds, rich
text, hand-drawn renderer, fill patterns, libraries, multi-page, converters,
AI/text-to-diagram and MCP.

Exit criteria: each package has an owner, docs and an independent release
cadence.

## 6. Non-goals (for core)

- Built-in toolbar, style panel, context menu or command palette.
- Real-time collaboration, presence, comments or version history.
- Rich text engine.
- Hand-drawn/rough rendering.
- Embeds, bookmarks, video or web pages.
- Multi-page documents.
- PDF export.
- AI generation or text-to-diagram.
- Localization/i18n UI; core stays locale-agnostic.
- Framework-specific UI components.

These are valid product features; they belong in examples or optional packages.

## 7. Success metrics

| Metric                     | Target                                            |
| -------------------------- | ------------------------------------------------- |
| Core gzip size             | ≤ 45 KB (baseline 42.2 KB)                        |
| Tree-shaken AdrawCanvas    | ≤ 43 KB                                           |
| Helper-only import         | ≤ 5 KB                                            |
| Runtime dependencies       | 0                                                 |
| Public API JSDoc coverage  | 100%                                              |
| Time to first canvas       | ≤ 5 minutes                                       |
| Agent round-trip eval      | ≥ 95%                                             |
| 1k elements                | 60fps pan/zoom                                    |
| 10k elements               | Usable (≥ 30fps) with culling; hit-test under 5ms |
| Breaking changes after 1.0 | 0 without a major                                 |
| Document migrations        | Fixtures from every shipped version               |

## 8. Risks and mitigations

| Risk                          | Mitigation                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Scope creep into app features | Non-goals; optional packages; roadmap review every minor.                             |
| SVG performance ceiling       | Benchmark early; keep the renderer replaceable; consider canvas only if targets fail. |
| Custom shape API complexity   | Minimal contract; one reference package; tree-shakable.                               |
| Agent API ossification        | Commands are a thin facade; additive changes; version the command schema.             |
| Schema evolution              | Version every document; write migrations and fixtures from day one.                   |
| Bundle growth                 | CI size budget; zero dependencies; optional packages.                                 |
| Maintainer bandwidth          | P0/P1 first; timebox P2; publish a "not now" list.                                    |

## Appendix A — Gap mapping

| Capability                        | tldraw  | Excalidraw | adraw plan                           |
| --------------------------------- | ------- | ---------- | ------------------------------------ |
| Hand-drawn style                  | Partial | Yes        | Optional renderer (P3)               |
| Stroke and fill styles            | Yes     | Yes        | Stroke P1; fill patterns P3 optional |
| Arrowhead and arrow routing       | Yes     | Yes        | P1                                   |
| Multi-point lines and arrows      | Yes     | Yes        | P2                                   |
| Lasso, laser, highlighter         | Partial | Yes        | P3                                   |
| Frames and sections               | Yes     | Frames     | Frames P2; sections out of scope     |
| Embeds, bookmarks, video          | Yes     | Yes        | P3 optional package                  |
| Rich text                         | Yes     | Partial    | P3 optional package                  |
| Libraries and templates           | Assets  | Libraries  | P3 optional package                  |
| Collaboration, presence, comments | Yes     | Yes        | P3 optional package                  |
| Version history                   | Yes     | Partial    | P3 optional package                  |
| Custom shapes and tools           | Yes     | Limited    | P1–P2                                |
| Export PDF                        | Yes     | Yes        | P3 optional package                  |
| Import converters                 | Native  | Native     | P3 optional package                  |
| Multi-page                        | Yes     | No         | P3 optional package                  |
| AI and text-to-diagram            | Yes     | Plugins    | P3 optional package                  |
| Built-in UI                       | Yes     | Yes        | Out of core; `@adraw/ui` P3          |
| Grid and snap to grid             | Yes     | Yes        | P0                                   |
| Lock/hide                         | Yes     | Yes        | P0                                   |
| Align/distribute                  | Yes     | Partial    | P0                                   |
| Duplicate, nudge, zoom shortcuts  | Yes     | Yes        | P0                                   |
| System clipboard and file drop    | Yes     | Yes        | P0                                   |
| Versioned document and migrations | Yes     | Yes        | P0                                   |
