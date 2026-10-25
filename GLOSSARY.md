# adraw

An infinite SVG canvas with a headless engine and an optional DOM adapter.

## Language

**AdrawStore**:
The adapter-facing module that owns a snapshot of canvas state and notifies subscribers when that snapshot changes.
_Avoid_: binding, mirror

**AdrawSnapshot**:
The immutable state value read from an AdrawStore at one revision.
_Avoid_: state, view state

**Scene**:
The elements and selection that make up the canvas content, together with their undo history.
_Avoid_: document, canvas state

**Commit**:
A single atomic change to a Scene that updates elements, selection and history together.
_Avoid_: transaction, mutation

**Element binding**:
A relationship in which an arrow endpoint follows another element.
_Avoid_: binding (unqualified), connector

**Bound text**:
A text element owned by a container element and kept aligned with it.
_Avoid_: label, label binding
