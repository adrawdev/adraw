# adraw

An infinite SVG canvas with a headless engine and an optional DOM adapter.

## Language

**AdrawStore**:
The adapter-facing state source that exposes the current AdrawSnapshot and notifies subscribers when it changes.
_Avoid_: binding, mirror, state manager

**AdrawSnapshot**:
The immutable, internally coherent state value read from an AdrawStore at one revision.
_Avoid_: state, view state

**Canvas operation**:
One synchronous public call into the engine or mounted canvas that may change observable state, including every nested call made while it runs; async `withoutHistory` publishes at its own boundaries.
_Avoid_: transaction, command

**State publication**:
The single internal notification emitted when the outermost Canvas operation finishes, including when it throws, carrying the deduplicated state kinds that changed. AdrawStore produces at most one new snapshot revision per publication; async `withoutHistory` publishes at its own boundaries.
_Avoid_: event, change event

**Scene**:
The elements and selection that make up the canvas content, together with their undo history.
_Avoid_: document, canvas state

**CanvasDocument**:
The serializable form of a Scene's elements used to save and restore content; it excludes selection and history.
_Avoid_: scene, canvas state

**Scene operation**:
An atomic write to a Scene through one of its commit, replace or select paths.
_Avoid_: transaction, mutation

**Commit**:
A Scene operation that applies a draft of elements and selection; a history checkpoint is recorded only when requested.
_Avoid_: transaction, mutation

**Checkpoint**:
A Scene state recorded in undo history so undo can restore it and redo can reapply it.
_Avoid_: snapshot, save point

**Canvas element**:
An object in a Scene: one of a shape, path, arrow, text, note, media or group.
_Avoid_: node, shape (for the general concept)

**Element binding**:
A relationship in which an arrow endpoint follows another element.
_Avoid_: binding (unqualified), connector, link

**Bound-text container**:
An element that can own bound text: a rectangle, ellipse, diamond or arrow.
_Avoid_: label container, text container

**Bound text**:
A text element owned by a bound-text container and kept aligned with it.
_Avoid_: label, label binding

**Group**:
A non-rendered container element whose bounds and z-index are derived from its visible descendants.
_Avoid_: folder, layer

**Adapter**:
A package that owns one canvas and AdrawStore and projects its snapshots into a framework or platform's reactivity.
_Avoid_: binding, wrapper

**Adapter state**:
The reactive projection of an AdrawSnapshot exposed by an Adapter.
_Avoid_: canvas state, view state

**Mount container**:
The host DOM element that contains a mounted canvas.
_Avoid_: container (unqualified), canvas element
