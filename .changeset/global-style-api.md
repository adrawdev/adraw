---
"@adraw/core": major
"@adraw/react": major
"@adraw/solid": major
"@adraw/vue": major
"@adraw/svelte": major
"@adraw/angular": major
"@adraw/web-components": major
---

Replace the per-tool style API with global `setStyle`/`getStyle`.

- Core: remove `getToolOptions`, `setToolOptions`, `setStrokeColor`, `CanvasOptions.tools`, the `toolOptionsChange` event, `ToolContext.getStrokeColor`, the `ToolOptions` alias (use `CanvasElementStyle` instead), the per-tool style types/helpers (`ToolOptionsMap`, `ConfigurableToolType`, `ResolvedToolOptions`, `ToolOptionsConfig`, `ToolOptionsState`, `ToolOptionsChangeEvent`, `CONFIGURABLE_TOOLS`, `DEFAULT_TOOL_OPTIONS`, `inferConfigurableTool`, `resolveToolOptions`, `resolveAllToolOptions`, `getDefaultToolOptionsFor`, `isConfigurableTool`, `getElementTypeForTool`, `getToolForElementType`), and rename `getToolOptionsForContext` to `getStyleForContext`. Use `canvas.setStyle({ strokeColor })` instead of `setStrokeColor(color)`, and read styles with `canvas.getStyle()`.
- React, Solid, Vue, Svelte and Angular: remove the `useToolOptions` and `useStyle` hooks and their exported types. Use the engine's `setStyle` / `getStyle` directly (via `useCanvas`/`useCanvasEngine` or `CanvasService.instance`).
- Web Components: remove the mirrored `toolOptions` field, `getToolOptions` / `setToolOptions` methods and the `adraw:tooloptionschange` event. Use `element.canvas?.setStyle()` / `getStyle()`.
