---
"@adraw/core": minor
"@adraw/web-components": minor
---

Add an optional background grid and snap-to-grid.

```ts
const canvas = new AdrawCanvas({
  container,
  grid: { enabled: true, size: 20, snap: true },
})

canvas.setGridConfig({ enabled: false, size: 40, snap: true })
canvas.getGridConfig()
```

- `GridConfig` (`enabled`, `size`, `snap`) plus `createGridConfig` and `DEFAULT_GRID_CONFIG`; defaults are hidden, 20 canvas units, snapping off.
- `CanvasOptions.grid`, `getGridConfig()` and `setGridConfig()` for runtime configuration.
- Grid rendering behind elements in the DOM adapter, with `--adraw-grid` and `--adraw-grid-opacity` CSS variables. The visual step doubles at low zoom so lines stay at least 8 screen pixels apart.
- Grid snapping for creation, move and resize, independent of modifier-gated element snapping. Element guides win per axis and the grid fills the other axis; grid snapping never draws guides.
- `AdrawSnapshot.grid` and the mirrored `<adraw-canvas>.grid` field.
- The grid is excluded from `toImage()` exports.
