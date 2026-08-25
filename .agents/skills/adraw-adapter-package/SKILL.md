---
name: adraw-adapter-package
description: Create and verify new adraw framework adapter packages. Use this skill whenever the user adds a React, Vue, Svelte, Solid, Angular, Web Components, or other framework binding, scaffolds a package under packages/, wraps AdrawCanvas, or needs adapter-specific build and verification guidance.
compatibility: Requires the adraw pnpm workspace and its existing package/build conventions.
---

# Adraw Adapter Packages

Use this skill when creating a new framework adapter package under `packages/*`.
Follow existing adapter packages for naming, exports, and example structure.

## Package Scaffolding

- `package.json`: name `@adraw/<framework>`, `@adraw/core` as a `"workspace:*"` dependency, the framework pinned in `devDependencies`, and loosely specified in `peerDependencies`. Copy `main`/`module`/`types`/`exports` from an existing adapter.
- `scripts`: `"build": "tsdown --minify"`, `"dev": "tsdown --watch"`
- `tsconfig.json`: extend `../../tsconfig.json`; add JSX configuration when needed
- `tsdown.config.ts`: export `tsdownConfig()` from `../../config/index.ts`; do not override `entry` or `format`
- No workspace registration is needed because `pnpm-workspace.yaml` globs `packages/*`

## Wrapping `AdrawCanvas`

- Create one canvas per adapter instance, headless with `new AdrawCanvas(options)`, then call `mount(container)` once the DOM exists
- Keep the canvas instance outside reactive state, such as in a ref or plain variable
- Mirror all four core events and always copy their payloads with `new Map(newElements)` and `new Set(newSelectedIds)`
- Expose all six hooks: `useCanvas`, `useTool`, `useViewport`, `useHistory`, `useSelection`, and `useTransformOverlay`
- Provide a `Canvas` component that renders the mount container and creates and destroys the canvas
- Context-based adapters (React, Solid, Vue) support multiple independent instances; singleton-based adapters (Svelte) do not
- Add the client-only directive `"use client"` for React SSR

## Verifying

- Add an `examples/vite-<framework>` app following existing example layouts
- Run `pnpm --filter=<framework> build` and `pnpm lint`

## Angular

Angular uses `ng-packagr`, not tsdown. Build it with:

```bash
ng-packagr -p ng-package.json
```

Its `tsconfig.json` does not extend the root configuration and therefore does
not use `erasableSyntaxOnly`. `tslib` is a required runtime dependency. See
`packages/angular/` for the complete Angular package pattern.

## Web Components

Web Components has no hooks; the custom element is the complete public surface.
Drive it through `element.canvas`, read its mirrored fields directly, and
listen to `adraw:*` `CustomEvent`s. It has no peer dependencies because it uses
native DOM APIs.

## Submission

Update or add adapter tests and use the repository testing skill at
`.agents/skills/adraw-testing/SKILL.md` for the required checks before
submitting.
