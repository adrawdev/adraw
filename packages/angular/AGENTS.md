# AGENTS.md — @adraw/angular

## Purpose

Angular bindings for adraw. Component-scoped `CanvasService` via `provideCanvas()`, injectable hooks returning Angular signals.

Angular uses `ng-packagr` (not tsdown) and has special build requirements.

## Important: Angular is special

- **Build tool is `ng-packagr`, not tsdown.** Build command: `ng-packagr -p ng-package.json -c tsconfig.json`
- **`tsconfig.json` does NOT extend `../../tsconfig.json`** — root config's `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noEmit`, and `allowImportingTsExtensions` conflict with Angular decorators / ng-packagr emit
- **`tslib` is a required runtime `dependency`** — ng-packagr forces `importHelpers: true`, so the compiler emits helper refs that need `tslib`. Do NOT remove it even if the bundle appears not to use it
- Source `package.json` must carry `module` + `typings` pointing at `./dist/...` for pnpm consumers (don't add `exports` map — ng-packagr regenerates it and warns)
- `pnpm-workspace.yaml` `allowBuilds` needs `@parcel/watcher` (ng-packagr watch), `lmdb`, `msgpackr-extract` (`@angular/build`)
- `.oxlintrc.json` has overrides turning off `new-cap` and `typescript/no-extraneous-class` for Angular files
- Reactive values are **signals** — read them by calling (`tool()`), including in templates

## Exports

From `src/public-api.ts`:

- `Canvas` — `adraw-canvas` component (`src/lib/canvas.component.ts`)
- `CanvasService` — injectable service wrapping `AdrawCanvas`
- `provideCanvas()` — provider function for `CanvasService`
- `CANVAS_OPTIONS` — `InjectionToken` for `CanvasAngularOptions`
- `CanvasAngularOptions` — interface extending `CanvasOptions`
- `useCanvas()` — returns `CanvasService` (via `inject`)
- `useTool()` — returns `{ tool: Signal<ToolType>, setTool: (t) => void }`
- `useViewport()` — returns `{ viewport, setViewport, zoomIn, zoomOut, resetZoom, zoomToFit }` (viewport is a signal)
- `useHistory()` — returns `{ undo, redo, canUndo, canRedo }` (canUndo/canRedo are signals)
- `useSelection()` — returns `{ selectedIds, elements, selectAll, clearSelection, deleteSelected }` (signals)
- `useTransformOverlay()` — returns `{ hideWhileTransforming, setHideWhileTransforming }` (signal)

## Usage

```typescript
import { provideCanvas, Canvas, useTool } from "@adraw/angular"
import { Component, inject } from "@angular/core"

@Component({
  selector: "app-root",
  template: `
    <div class="toolbar">
      <button (click)="toolHook.setTool('rectangle')">Rectangle</button>
    </div>
    <adraw-canvas class="w-full h-full" />
  `,
  imports: [Canvas],
  providers: [provideCanvas()],
})
export class AppComponent {
  toolHook = inject(useTool())
}
```

All hooks return signals for reactive values — read by calling them.

## How it works

1. `provideCanvas()` creates the `CanvasService` singleton at the component injector level
2. `Canvas` component mounts `AdrawCanvas` in `ngOnInit`, subscribes to all 4 events, mirrors into Angular signals
3. Hooks call `inject(CanvasService)` and return the signal + method surface
4. `CanvasService` is scoped to the providing injector — multiple independent canvases possible via different component injectors

## Build

```bash
pnpm build:angular    # ng-packagr -p ng-package.json -c tsconfig.json
pnpm dev:angular      # ng-packagr -p ng-package.json -c tsconfig.json --watch
```

Build produces partial-Ivy output in `dist/`. The `scripts/finalize-dist.mjs` post-build step handles any required dist adjustments.

## Dependencies

- `@adraw/core`: `workspace:*`
- `@angular/common`, `@angular/core`, `@angular/compiler`, `@angular/compiler-cli`: `^22.0.0`
- `ng-packagr`: `^22.0.0`
- `tslib`: `^2.8.1` (required runtime dependency)
- Peer deps: `@angular/common` >=17.0.0, `@angular/core` >=17.0.0

## Code style

- No semicolons, double quotes, 2-space indent
- `experimentalDecorators: false`, `useDefineForClassFields: false` in tsconfig
- `angularCompilerOptions.compilationMode: "partial"`
- Signals for reactivity (`WritableSignal`/`Signal`), not RxJS `BehaviorSubject`
- Override linter rules for `new-cap` and `typescript/no-extraneous-class`
