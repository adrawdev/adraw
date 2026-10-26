# Scene transactions and AdrawStore replace engine events

## Status

accepted

## Context

`CanvasEngine` exposes four low-level events — `change`, `viewportChange`, `toolChange` and `selectionChange` — whose payloads are live maps and sets. Every adapter re-implements the same seed → subscribe → copy → readiness protocol, and the events do not cover history availability, style, snapping, tool lock or overlay visibility. The result is six mirrors, shadow state and behaviour that has already diverged.

## Decision

Do the work in two phases.

**Phase 1** extracts an internal `Scene` module that owns elements, selection, history, binding sync and atomic commits (`commit`, `replace`, `select`). `CanvasEngine` keeps viewport, tool, style, snapping, clipboard storage and the text-measurer source. `Scene` returns a `SceneChange` and does not emit engine events; the engine keeps the existing event order.

**Phase 2** adds a public `AdrawStore` in `@adraw/core`, exposing an `AdrawSnapshot` through `getSnapshot()` and `subscribe()`. Adapters move onto it, and the public `on`/`off`, `CanvasEventMap` and the four events are removed. The DOM adapter and the store consume one internal kind-carrying notifier; the store reuses unchanged snapshot slices, so a viewport change does not copy the element map.

## Consequences

- Phase 1 is behaviour-preserving and can land on its own; the existing core tests are its contract.
- Phase 2 is a breaking core change: direct event consumers must use `AdrawStore`.
- Adapters become thin reactivity adapters. `useHistory` keeps its function signatures but reads the snapshot, fixing Svelte without an API break. `useCanvas()` gains `store` and `snapshot`; `useStyle()` is added to all six adapters.
- Web Components keeps its engine and document across reconnect, matching the other adapters.
- The store is the only public observation seam. The four events are removed, not deprecated.
- [ADR-0002](0002-operation-scoped-state-publication.md) later scopes that seam to one publication per canvas operation so every observed snapshot is coherent.

## Considered options

- **Keep the four events and add the store additively.** Rejected: it leaves two observation interfaces and preserves the shadow-state drift.
- **Put the store in a new `@adraw/adapter` package.** Rejected: all adapters already depend on `@adraw/core`, and the module has no DOM dependency.
- **Build the store before the scene.** Rejected: the store needs one reliable mutation and history path to notify from.
