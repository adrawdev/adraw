# Operation-scoped state publication

## Status

accepted

## Context

ADR-0001 made `AdrawStore` the only public observation seam and gave the DOM adapter and the store one internal kind-carrying notifier. The notifier published each changed slice separately. One public operation could therefore advance the store revision several times, and listeners could observe an `AdrawSnapshot` whose `elements` had changed while `selectedIds` still named deleted elements. Operations such as `setStyle`, undo and redo also combined Scene changes with non-Scene slices.

## Decision

A **canvas operation** is one synchronous public mutation of the engine or mounted canvas, including every nested call made while it runs. A **state publication** is the single internal notification emitted when the outermost canvas operation completes. It carries the deduplicated set of changed state kinds, with no ordering contract.

- The internal state notifier owns operation depth, pending kinds and synchronous dispatch. `Scene` stays pure and keeps returning `SceneChange`.
- Engine methods, ToolContext mutations and programmatic or native event entry points open an operation. Nested operations join the outer scope.
- Async `withoutHistory` is exempt from batching across `await`: its synchronous mutations and final history update publish at their own boundaries.
- `AdrawStore` reads one engine state boundary, updates all affected slices together, reuses unchanged references and increments `revision` at most once.
- A failed operation publishes the state that actually remains before rethrowing its original error. This does not add operation-level rollback.
- Listener collections are captured at publication start. A listener error does not prevent later delivery; the operation error wins, otherwise the first listener error is rethrown after dispatch.
- The DOM adapter derives one fixed, deduplicated render plan from the publication.

## Consequences

- Every published AdrawSnapshot is internally coherent, and adapters receive at most one update per completed operation.
- A no-op operation publishes no snapshot even when internal code marked a slice dirty.
- Store listeners remain synchronous and may start new operations reentrantly; each such operation gets its own publication.
- `SceneChange.revision` is removed. The store revision is the only revision consumers observe.
- Direct `renderAll()` calls from DOM gesture handlers remain a separate invalidation concern; they are not part of this observation contract.
