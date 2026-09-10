# @adraw/core

## 0.3.0

### Minor Changes

- Resize elements from the center while holding the Alt key.

- [`6d5962e`](https://github.com/adrawdev/adraw/commit/6d5962e5577fe1138a557136e76666f5c78cfcfa) Constrain element proportions while resizing with the Shift key.

- [`ab7567d`](https://github.com/adrawdev/adraw/commit/ab7567d058310627b9fb046ea6804af731ef37c2) Add pointer capture on drag start so drawing, moving, resizing, and rotating keep working when the pointer leaves the container or the browser window. A cancelled pointer (e.g. an OS gesture taking over) now finalizes the in-progress tool action instead of leaving it stuck.

- Add `toImage()` to export the canvas as an image blob (PNG or SVG), with options for background, pixel ratio, dark mode, and dynamic styling.

- Split the canvas into a headless `CanvasEngine` and a DOM adapter. `AdrawCanvas` now extends `CanvasEngine` and can be constructed headless with deferred `mount(container)` and `destroy()` lifecycle methods.

- Add `insertMedia()` for inserting image and media elements, with automatic viewport fitting, z-index layer management, and auto-selection of inserted elements.

- Show per-element bounding boxes for multi-selections in the transform overlay, in addition to the group bounds.

- Add global stroke color management via `setStrokeColor()`, customizable stroke properties for rectangles and ellipses, and round stroke caps and joins for line and path elements.

- Add a text tool and `TextElement` type with inline editing. Click with the text tool to create editable multi-line text rendered as SVG, with an inline textarea overlay for editing.

### Patch Changes

- Fix text editor and selection behavior: keep the text editor and toolbar visible during editing, prevent native text selection from interfering with canvas gestures, and match the text editor stroke color to the active stroke.

- [`4b50663`](https://github.com/adrawdev/adraw/commit/4b50663cbfd1f8e71f6e5ff960eb248ea41e426a) Allow dragging multiple selected elements from empty space inside their selection bounds.

## 0.2.0

### Minor Changes

- **Line tool**: new `line` element type with `startX`/`startY`/`endX`/`endY`, dedicated line tool in the tool system, hit testing, selection stroke, and rotation support.

- **Auto-switch to select**: after creating an element with any creation tool (rectangle, ellipse, line, draw), the canvas automatically switches to the select tool. The newly created element is also automatically selected. Automatic selection can be prevented when needed.

- **Light-dark color mode**: color constants now support `light-dark()` CSS color function, enabling automatic theme adaptation via CSS `color-scheme`.

- **Transform overlay improvements**:

  - Overlay now renders immediately on tool change and clears selection on deactivation.
  - `isTransforming` split into `isResizing` and `isRotating` for more granular overlay suppression.
  - Improved rotation handling for multi-selection groups.
  - `selectElements` renamed to `renderSelectElements`.
  - Redundant line stroke update logic removed.

## 0.1.1

### Patch Changes

- **Rendering architecture (major refactor)**

  - **Incremental DOM**: replaced full `innerHTML = ""` wipe with `reconcileElements()` that diffs the DOM: drops stale nodes, updates existing in place, appends new ones. Unchanged elements keep their DOM nodes intact.

  - **Temporary group removed**: in-progress tool elements render directly into `elementsGroup` as the last child, tracked by a reusable `temporaryNode`/`temporaryType`, avoiding node recreation per pointer move.

  - **Persistent transform overlay**: `ensureOverlayNodes()` builds bounding box, 4 edge bands, rotation handle, and 4 resize handles once; `renderTransformOverlay()` updates them in place (\~10 fewer SVG nodes created per pointer move).

  - **`updateElementGeometry()`**: shared in-place update helper for all element types, used by both `reconcileElements()` and `selectElements()`.

- **Select tool**

  - **Marquee/brush selection**: pointer-down on empty space starts a rubber-band box; all intersected elements get selected. Shift-key unions onto existing selection. No history push for selection-only actions.

  - **Multi-element rotation**: orbiting each element's center around the selection center (not just changing rotation). Path elements get points translated. Single elements still rotate in place.

  - **`isTransforming()` / `getSelectionBox()`**: new Tool interface methods; first signals active resize/rotation, second exposes the marquee rect.

  - **Invisible edge bands**: 4 translucent lines on edges act as axis-aligned resize handles via `pointer-events: stroke`.

- **History**

  - **Baseline checkpoint**: the undo stack top now always mirrors current state; `canUndo()` returns false only when only the baseline remains. Fixes undo restoring from the wrong entry and redo pushing stale state onto the undo stack.

- **Styling \& constants**

  - **src/constants.ts**: new file centralizing CSS-var fallback strings (`STROKE_COLOR`, `FILL_COLOR`, `BACKGROUND_COLOR`, `SELECTION_COLOR`) and numeric `STROKE_WIDTH = 2`.

  - **CSS var rename**:

    - `--adraw-stroke-color` → `--adraw-stroke`
    - `--adraw-fill-color` → `--adraw-fill`
    - `--adraw-selection-color` → `--adraw-selection`

  - **Non-scaling stroke**: bounding box and handles use `vector-effect="non-scaling-stroke"` and sizes divided by `viewport.zoom` for screen-pixel consistency.

- **Options \& API**

  - **`hideOverlayWhileTransforming`**: new `CanvasOptions` flag (default true) to hide transform overlay during resize/rotation gestures so it doesn't visually lag. Exposed via `getHideOverlayWhileTransforming()` / `setHideOverlayWhileTransforming()`.

- **Path element**

  - **`fillColor` removed from `PathElement` type and `createPathElement`**: paths render `fill="none"` unconditionally.
