# API stability and deprecation policy

**Status:** accepted · **Last updated:** 2026-11-09

This policy covers every package published from this repository:
`@adraw/core`, the framework adapters and `@adraw/web-components`. It defines
what counts as public, how versions communicate change, how APIs are deprecated
and what a breaking change must ship with.

## Public API

The public API is:

- Everything exported from a package entry point (`packages/*/src/index.ts`,
  and `packages/angular/src/public-api.ts` for Angular).
- The documented behavior of those exports, including options, defaults,
  return values and emitted error codes.
- The `CanvasDocument` serialized format.
- The `--adraw-*` CSS custom properties.
- The `adraw:*` Web Component events.

Anything else is internal, even when it is technically reachable:

- APIs marked `@internal` in JSDoc.
- Modules that are not re-exported from a package entry point (`Scene`,
  `state-notifier`, `engine/internal.ts`, `dom/*`, clipboard internals).
- CSS class names, DOM structure and rendering implementation details.
- `examples/*`, `web/`, `e2e/` and the docs site.

The detailed inventory lives in [PUBLIC_API.md](PUBLIC_API.md). If an export is
missing from that inventory, treat its absence as a documentation bug, not as
permission to change it silently.

## Versioning

adraw uses [semantic versioning](https://semver.org/). Published packages are
versioned independently through Changesets.

### Before 1.0

- **Patch** — backwards-compatible fixes, internal changes, documentation and
  rendering corrections that do not change the public contract.
- **Minor** — new features and additive API. Pre-1.0, a minor may include a
  breaking change when it cannot be avoided, but it **must** include a migration
  guide and call the break out in the changeset.
- **Major** — reserved for the 1.0 release and later major versions.

### After 1.0

Strict semver applies: breaking changes require a major release.

### What counts as breaking

- Removing or renaming an export, method, option, element field, event or CSS
  custom property.
- Changing a signature, return type, default, error code or documented
  behavior in a way existing code can observe.
- Adding a required option or field.
- Removing or changing an error code, or changing what an existing code means.
- Changing the `CanvasDocument` schema without a migration.
- Changing snapshot shape in a way that breaks readers.
- Changing keyboard shortcuts or editing semantics that consumers rely on.

### What is additive

These are normally non-breaking:

- Adding an optional option or field.
- Adding a new export, method, helper, error code or CSS custom property.
- Adding a new element or tool type, with release notes. Consumers that
  exhaustively switch on the union may need to update; call this out.
- Documentation, examples and performance improvements.
- Visual changes that preserve the public contract.

When in doubt, treat the change as breaking and document it.

### Error codes

`AdrawError.code` values and `ADRAW_ERROR_CODES` are part of the public
contract. Adding a code is additive. Removing, renaming or redefining a code is
breaking.

### Document format

`CanvasDocument.version` is part of the contract. Any schema change must ship
with a migration in `docs/migrations/` and fixtures from every shipped version.

## Deprecation

Deprecate before removing when a replacement exists:

1. Mark the API with `@deprecated` JSDoc, including the replacement and the
   earliest removal version.
2. Keep the deprecated API working for the deprecation window.
3. Document the migration in the relevant guide and changeset.
4. Remove it only in an allowed release.

```ts
/**
 * @deprecated Use `updateElement(id, { visible })` instead. Removed in 0.8.
 */
setVisible(id: ElementId, visible: boolean): void
```

Deprecation windows:

- **Before 1.0** — deprecate in `0.N`, remove no earlier than `0.N+1`.
- **After 1.0** — deprecate in `1.N`, remove no earlier than `2.0.0`.

Security fixes may remove a broken API immediately; the release notes must say
why. adraw does not emit runtime deprecation warnings by default, because
libraries must not spam consumer consoles. The JSDoc, changelog and migration
guide are the warning.

## Experimental APIs

APIs marked `@experimental` in JSDoc are outside the stability guarantees: they
may change or disappear in any release. Experimental APIs must still be
documented and tested. Promote them to stable by removing the marker in a
changeset that says so.

## Changesets

Every published package change needs a changeset (`pnpm changeset`). Docs,
examples and the `web` site are ignored by the Changesets configuration.

| Change                                              | Bump              |
| --------------------------------------------------- | ----------------- |
| Bug fix, internal refactor, docs in a package       | patch             |
| New feature, new export, additive option/error code | minor             |
| Breaking change after 1.0                           | major             |
| Breaking change before 1.0                          | minor + migration |

If a change touches several packages, list each affected package. Adapters need
a changeset when their public surface changes or when a core change requires
them to change behavior.

Changeset text should answer: what changed, who is affected and what to do. Link
the migration guide for breaking changes.

## Breaking change process

1. Open an issue or ADR for significant API changes before implementing.
2. Add the changeset with the correct bump.
3. Add `docs/migrations/<from>-to-<to>.md` describing the break, before/after
   examples and any codemods.
4. Deprecate first when a replacement exists.
5. Update adapters, docs, examples and tests in the same change.
6. Link the migration guide from the changelog and release notes.

Breaking changes that cannot follow the deprecation window (security, data
corruption, platform removal) still require a migration guide and a clear
release note.

## PR checklist

- [ ] PR title uses `[package-name] Brief description`.
- [ ] Tests cover the change, or the PR explains why none are needed.
- [ ] A changeset exists for every published package change.
- [ ] Public exports have JSDoc and, when the surface changed,
      [PUBLIC_API.md](PUBLIC_API.md) is updated.
- [ ] Deprecated APIs use `@deprecated` with a replacement and removal target.
- [ ] Breaking changes include a migration guide and the right bump.
- [ ] Docs and examples are updated.

## References

- [Public API inventory](PUBLIC_API.md)
- [Roadmap](ROADMAP.md)
- [Architecture decisions](adr/)
- [Changesets](https://github.com/changesets/changesets)
