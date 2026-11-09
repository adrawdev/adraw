## Summary

<!-- What changed, why, and which package(s) are affected? -->

## Checklist

- [ ] PR title follows `[package-name] Brief description`.
- [ ] Tests cover the change, or the PR explains why none are needed.
- [ ] A changeset exists for every published package change.
- [ ] Public exports have JSDoc, and `docs/PUBLIC_API.md` is updated when the
      public surface changes.
- [ ] Deprecated APIs use `@deprecated` with a replacement and removal target.
- [ ] Docs and examples are updated.

## Breaking changes

<!-- None, or link the migration guide under docs/migrations/. -->

- [ ] This PR contains no breaking change.
- [ ] This PR contains a breaking change and ships a migration guide, the
      correct changeset bump, and a release-note entry.

See [`docs/API_STABILITY.md`](../docs/API_STABILITY.md) for the full policy.
