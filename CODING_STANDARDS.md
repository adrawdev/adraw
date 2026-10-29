# Coding Standards

This file is read during review, not implementation. It records judgement calls that a linter cannot enforce; mechanical rules belong in `oxlint`, `oxfmt`, CI, or the pre-commit hook.

## Terminology

Canonical vocabulary is in [GLOSSARY.md](GLOSSARY.md). Review prose, JSDoc, README/AGENTS text and changesets against it, not just code identifiers.

- Use the glossary term in prose and JSDoc. Existing public API identifiers may lag; `labelPosition` is an identifier, not the domain term.
- "Shape" means a rectangle, ellipse or diamond. For the general object, use "canvas element" or the specific type.
- Unqualified "binding" means an element binding: an arrow endpoint following an element. Framework packages are "adapters", not "bindings".
- "Document" means `CanvasDocument`, the serialized elements. It is not a live `Scene`.
- "Container" alone is ambiguous: use "bound-text container" for an element that owns bound text, and "mount container" for the host DOM element.
- Keep the `_Avoid_` lists in `GLOSSARY.md` current when a term is resolved.

## Public API documentation

The JSDoc requirement for exported APIs is in [Code conventions](AGENTS.md#code-conventions).
