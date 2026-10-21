import {
  FILL_COLOR,
  STROKE_COLOR,
  STROKE_WIDTH,
  TEXT_FONT_SIZE,
} from "./constants"
import { DEFAULT_PATH_SMOOTHING } from "./elements"
import type { ToolOptions } from "./tools/base"
import type { DrawToolOptions } from "./tools/draw"
import type { RectangleToolOptions } from "./tools/rectangle"
import type { TextToolOptions } from "./tools/text"
import type { CanvasElement, ElementId, ElementType, ToolType } from "./types"

/**
 * Style option shape for each configurable drawing tool. Select, hand and
 * eraser have no style options.
 */
export interface ToolOptionsMap {
  /** Arrow stroke options. */
  arrow: ToolOptions
  /** Freehand path options, including `smoothing`. */
  draw: DrawToolOptions
  /** Ellipse stroke options. */
  ellipse: ToolOptions
  /** Line stroke options. */
  line: ToolOptions
  /** Rectangle options, including `cornerRadius`. */
  rectangle: RectangleToolOptions
  /** Text options, including `fontSize`. */
  text: TextToolOptions
}

/** Tools whose style can be configured through {@link CanvasOptions.tools}. */
export type ConfigurableToolType = keyof ToolOptionsMap

/** Style options accepted by one tool. */
export type ToolOptionsFor<T extends ConfigurableToolType> = ToolOptionsMap[T]

/** Fully resolved style options, including every default. */
export type ResolvedToolOptions<T extends ConfigurableToolType> = Required<
  ToolOptionsMap[T]
>

/** Partial per-tool style overrides accepted by {@link CanvasOptions.tools}. */
export type ToolOptionsConfig = {
  [T in ConfigurableToolType]?: ToolOptionsMap[T]
}

/** Resolved style options for every configurable tool. */
export type ToolOptionsState = {
  [T in ConfigurableToolType]: ResolvedToolOptions<T>
}

/**
 * `toolOptionsChange` payload. A discriminated union so listeners can switch on
 * `tool` and narrow `options` to that tool's option shape.
 */
export type ToolOptionsChangeEvent = {
  [T in ConfigurableToolType]: {
    tool: T
    options: ResolvedToolOptions<T>
  }
}[ConfigurableToolType]

/**
 * Every tool that accepts style options, in a stable order. Useful for
 * iterating defaults and emitting change events.
 */
export const CONFIGURABLE_TOOLS = [
  "arrow",
  "draw",
  "ellipse",
  "line",
  "rectangle",
  "text",
] as const satisfies readonly ConfigurableToolType[]

const DEFAULT_BASE_OPTIONS: Required<ToolOptions> = {
  fillColor: FILL_COLOR,
  opacity: 1,
  strokeColor: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
}

/**
 * Default style options for every configurable tool. The values mirror the
 * defaults used by the tool factories.
 */
export const DEFAULT_TOOL_OPTIONS: ToolOptionsState = {
  arrow: { ...DEFAULT_BASE_OPTIONS },
  draw: { ...DEFAULT_BASE_OPTIONS, smoothing: DEFAULT_PATH_SMOOTHING },
  ellipse: { ...DEFAULT_BASE_OPTIONS },
  line: { ...DEFAULT_BASE_OPTIONS },
  rectangle: { ...DEFAULT_BASE_OPTIONS, cornerRadius: 0 },
  text: { ...DEFAULT_BASE_OPTIONS, fontSize: TEXT_FONT_SIZE },
}

const TOOL_ELEMENT_TYPES: Record<ConfigurableToolType, ElementType> = {
  arrow: "arrow",
  draw: "path",
  ellipse: "ellipse",
  line: "line",
  rectangle: "rectangle",
  text: "text",
}

/**
 * Whether a tool accepts per-tool style options.
 *
 * @param tool Tool identifier.
 * @returns `true` when the tool appears in {@link ToolOptionsMap}.
 */
export function isConfigurableTool(
  tool: ToolType,
): tool is ConfigurableToolType {
  return (CONFIGURABLE_TOOLS as readonly ToolType[]).includes(tool)
}

/**
 * Element type created by a configurable tool.
 *
 * @param tool Configurable tool identifier.
 * @returns The element type the tool draws.
 */
export function getElementTypeForTool(tool: ConfigurableToolType): ElementType {
  return TOOL_ELEMENT_TYPES[tool]
}

/**
 * Inverse of {@link getElementTypeForTool}: the configurable tool that draws a
 * given element type, or `null` for media/group elements.
 *
 * @param type Element type.
 * @returns The matching configurable tool, or `null`.
 */
export function getToolForElementType(
  type: ElementType,
): ConfigurableToolType | null {
  for (const tool of CONFIGURABLE_TOOLS) {
    if (TOOL_ELEMENT_TYPES[tool] === type) {
      return tool
    }
  }
  return null
}

/**
 * Infer the tool whose style a toolbar should show. A homogeneous selection
 * wins (so the selected shape's style stays visible while the select tool is
 * active); mixed or non-drawable selections fall back to the active tool when
 * it is configurable.
 *
 * @param activeTool Current active tool.
 * @param elements Current element map.
 * @param selectedIds Selected element ids.
 * @returns The inferred configurable tool, or `null`.
 */
export function inferConfigurableTool(
  activeTool: ToolType,
  elements: ReadonlyMap<ElementId, CanvasElement>,
  selectedIds: ReadonlySet<ElementId>,
): ConfigurableToolType | null {
  if (selectedIds.size > 0) {
    let selectedTool: ConfigurableToolType | null = null
    let mixed = false
    for (const id of selectedIds) {
      const element = elements.get(id)
      if (!element) {
        continue
      }
      const elementTool = getToolForElementType(element.type)
      if (!elementTool) {
        mixed = true
        break
      }
      if (selectedTool === null) {
        selectedTool = elementTool
      } else if (selectedTool !== elementTool) {
        mixed = true
        break
      }
    }
    if (!mixed && selectedTool !== null) {
      return selectedTool
    }
  }

  return isConfigurableTool(activeTool) ? activeTool : null
}

/**
 * Copy a tool's default style options.
 *
 * @param tool Configurable tool identifier.
 * @returns A fresh, fully resolved options object.
 */
export function getDefaultToolOptionsFor<T extends ConfigurableToolType>(
  tool: T,
): ResolvedToolOptions<T> {
  return { ...DEFAULT_TOOL_OPTIONS[tool] } as ResolvedToolOptions<T>
}

/**
 * Merge partial overrides over a tool's defaults, ignoring `undefined` values.
 *
 * @param tool Configurable tool identifier.
 * @param overrides Partial options to merge.
 * @returns A fresh, fully resolved options object.
 */
export function resolveToolOptions<T extends ConfigurableToolType>(
  tool: T,
  overrides?: ToolOptionsMap[T],
): ResolvedToolOptions<T> {
  const resolved: Record<string, unknown> = {
    ...getDefaultToolOptionsFor(tool),
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) {
        resolved[key] = value
      }
    }
  }
  return resolved as ResolvedToolOptions<T>
}

/**
 * Resolve every tool's style options from an optional {@link CanvasOptions.tools}
 * configuration. Used by framework bindings to seed reactive toolbar state.
 *
 * @param config Partial per-tool overrides.
 * @returns Fully resolved options for every configurable tool.
 */
export function resolveAllToolOptions(
  config?: ToolOptionsConfig,
): ToolOptionsState {
  return {
    arrow: resolveToolOptions("arrow", config?.arrow),
    draw: resolveToolOptions("draw", config?.draw),
    ellipse: resolveToolOptions("ellipse", config?.ellipse),
    line: resolveToolOptions("line", config?.line),
    rectangle: resolveToolOptions("rectangle", config?.rectangle),
    text: resolveToolOptions("text", config?.text),
  }
}
