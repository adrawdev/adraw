import { syncArrowBindings } from "../bindings"
import { STROKE_COLOR } from "../constants"
import { getElementsBounds, getNextZIndex } from "../elements"
import {
  /**
   * Whether redo is currently possible.
   */
  canRedo,
  /**
   * Whether undo is currently possible.
   */
  canUndo,
  createHistoryState,
  pushHistory,
  type HistoryEntry,
  /**
   * Redo the last undone change.
   * @returns `true` if a redo was applied.
   */
  redo,
  /**
   * Undo the last change.
   * @returns `true` if an undo was applied.
   */
  undo,
} from "../history"
import type {
  CanvasEventMap,
  CanvasOptions,
  KeyboardScope,
  MediaInput,
} from "../options"
import { createSnappingConfig, type SnappingConfig } from "../snapping"
import {
  CONFIGURABLE_TOOLS,
  getElementTypeForTool,
  isConfigurableTool,
  resolveToolOptions,
  type ConfigurableToolType,
  type ResolvedToolOptions,
  type ToolOptionsChangeEvent,
  type ToolOptionsMap,
} from "../tool-options"
import {
  createArrowTool,
  createDrawTool,
  createEllipseTool,
  createEraserTool,
  createHandTool,
  createLineTool,
  createRectangleTool,
  createSelectTool,
  createTextTool,
} from "../tools"
import {
  getDefaultToolOptions,
  type Tool,
  type ToolContext,
} from "../tools/base"
import type {
  CanvasDocument,
  CanvasElement,
  ElementId,
  MediaElement,
  Point,
  SnapGuide,
  ToolType,
  ViewportState,
} from "../types"
import { createViewport, resetViewport, zoomViewport } from "../viewport"
import {
  ClipboardManager,
  cloneElementDeep,
  collectClipboardElements,
  createPastedElements,
} from "./clipboard"
import { createMediaElements } from "./media"
import {
  deleteSelectedElements,
  selectAllIds,
  computeZoomToFitViewport,
} from "./selection"
import { handleShortcutKey } from "./shortcuts"
import { applyToolOptionsToElement } from "./tool-options"
import {
  bringElementsToFront,
  sendElementsToBack,
  setElementZIndex,
} from "./z-order"

const DOCUMENT_VERSION = 1

type EventListener<K extends keyof CanvasEventMap> = (
  event: CanvasEventMap[K],
) => void

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  )
}

function normalizeIds(
  ids: ElementId | Iterable<ElementId>,
): Iterable<ElementId> {
  return typeof ids === "string" ? [ids] : ids
}

/**
 * Internal access shape used by adapter and engine hooks.
 * @internal
 */
export interface EngineInternal {
  /**
   * Get the currently active tool.
   */
  getActiveTool: () => ToolType
  getActiveToolInstance: () => Tool
  getCanvasSize: () => { height: number; width: number }
  /**
   * Get the current elements map. Caller should copy before storing.
   */
  getElements: () => Map<ElementId, CanvasElement>
  getPointerPoint: () => Point | null
  /**
   * Get the current selection ids.
   */
  getSelectedIds: () => Set<ElementId>
  getToolContext: () => ToolContext
  /**
   * Get the current viewport state.
   */
  getViewport: () => ViewportState
  setPointerPoint: (point: Point) => void
  /**
   * Set the viewport state and emit `viewportChange`.
   * @param viewport New viewport.
   */
  setViewport: (viewport: ViewportState) => void
  setSelectedIds: (ids: Set<ElementId>) => void
  setSnapGuides: (guides: SnapGuide[]) => void
  pushHistory: () => void
  emit: <K extends keyof CanvasEventMap>(
    event: K,
    data: CanvasEventMap[K],
  ) => void
}

// Headless canvas engine: pure state (elements, selection, viewport, tools,
// history) plus the event system. No DOM — a DOM adapter (see `dom/`) drives it
// through the public API and the `/** @internal */` hooks below.
/**
 * Headless canvas engine: pure state (elements, selection, viewport, tools,
 * history) plus the event system. No DOM. A DOM adapter drives it via the
 * public API and the `@internal` hooks.
 */
export class CanvasEngine {
  private elements = new Map<ElementId, CanvasElement>()
  private selectedIds = new Set<ElementId>()
  private viewport: ViewportState
  private activeTool: Tool
  private snappingConfig: SnappingConfig
  private isSnapMode: boolean
  private keyboardScope: KeyboardScope
  private snapGuides: SnapGuide[] = []
  private strokeColor: string = STROKE_COLOR
  private toolOptions = new Map<
    ConfigurableToolType,
    ToolOptionsMap[ConfigurableToolType]
  >()
  private hideOverlayWhileTransforming: boolean
  private history = createHistoryState()
  // Depth counter for `withoutHistory`; suppresses checkpoint pushes while > 0.
  private historySuppressionDepth = 0
  private clipboard: ClipboardManager
  // Last pointer position in canvas space, tracked by the dispatch helpers so
  // keyboard paste can land at the cursor.
  private pointerPoint: Point | null = null
  private listeners = new Map<keyof CanvasEventMap, Set<EventListener<any>>>()
  private canvasSize: { width: number; height: number } = {
    height: 0,
    width: 0,
  }
  private tools = new Map<ToolType, Tool>()

  // Fired when a render is needed (e.g. the overlay toggle re-renders
  // immediately). The DOM adapter sets this; null when headless.
  /** @internal */
  renderRequested: (() => void) | null = null
  // Fired just before the active tool changes so the adapter can commit any
  // in-progress DOM state (e.g. an open inline text editor).
  /** @internal */
  onToolWillChange: (() => void) | null = null

  constructor(options: CanvasOptions = {}) {
    this.viewport = createViewport(options.initialViewport)
    this.clipboard = new ClipboardManager(options.clipboard)
    this.snappingConfig = createSnappingConfig(options.snapping)
    this.isSnapMode = options.isSnapMode ?? false
    this.keyboardScope = options.keyboard ?? "canvas"
    this.hideOverlayWhileTransforming =
      options.hideOverlayWhileTransforming ?? false

    for (const tool of CONFIGURABLE_TOOLS) {
      const overrides = options.tools?.[tool]
      if (overrides) {
        this.toolOptions.set(tool, { ...overrides })
      }
    }

    this.tools.set("select", createSelectTool())
    this.tools.set("hand", createHandTool())
    this.tools.set(
      "rectangle",
      createRectangleTool(this.getToolOptions("rectangle")),
    )
    this.tools.set("ellipse", createEllipseTool(this.getToolOptions("ellipse")))
    this.tools.set("line", createLineTool(this.getToolOptions("line")))
    this.tools.set("arrow", createArrowTool(this.getToolOptions("arrow")))
    this.tools.set("draw", createDrawTool(this.getToolOptions("draw")))
    this.tools.set("eraser", createEraserTool())
    this.tools.set("text", createTextTool(this.getToolOptions("text")))

    this.activeTool = this.tools.get("select")!
    this.activeTool.onActivate(this.createToolContext())

    // Seed the baseline checkpoint so the first edit can be undone back to the
    // empty canvas. The top of the undo stack always mirrors the current
    // committed state.
    this.commitHistory()
  }

  private createToolContext(): ToolContext {
    return {
      getCanvasSize: () => this.canvasSize,
      getElements: () => this.elements,
      getIsSnapMode: () => this.isSnapMode,
      getSelectedIds: () => this.selectedIds,
      getSnappingConfig: () => this.snappingConfig,
      getStrokeColor: () => this.strokeColor,
      getToolOptions: () => {
        const tool = this.activeTool.type
        return isConfigurableTool(tool)
          ? this.getToolOptions(tool)
          : getDefaultToolOptions()
      },
      getViewport: () => this.viewport,
      pushHistory: () => {
        this.commitHistory()
      },
      setActiveTool: (tool) => this.setActiveTool(tool),
      setElements: (elements) => {
        this.elements = elements
        syncArrowBindings(this.elements)
        this.emit("change", { elements: this.elements })
      },
      setSelectedIds: (ids) => {
        this.selectedIds = ids
        this.emit("selectionChange", { selectedIds: this.selectedIds })
      },
      setSnapGuides: (guides) => {
        this.snapGuides = guides
      },
      setViewport: (viewport) => {
        this.viewport = viewport
        this.emit("viewportChange", { viewport: this.viewport })
      },
    }
  }

  // Record a checkpoint unless `withoutHistory` is currently suppressing them.
  private commitHistory(): void {
    if (this.historySuppressionDepth > 0) {
      return
    }
    this.history = pushHistory(this.history, this.elements, this.selectedIds)
  }

  // Fold the net change between `before` and the current elements into every
  // checkpoint. Changes made outside history must survive undo/redo instead of
  // reappearing/disappearing when an older snapshot is restored.
  private rebaseHistory(before: Map<ElementId, CanvasElement>): void {
    const added = new Map<ElementId, CanvasElement>()
    const changed = new Map<ElementId, CanvasElement>()
    const removed = new Set<ElementId>()

    for (const [id, element] of this.elements) {
      const previous = before.get(id)
      if (previous === undefined) {
        added.set(id, element)
      } else if (previous !== element) {
        changed.set(id, element)
      }
    }
    for (const id of before.keys()) {
      if (!this.elements.has(id)) {
        removed.add(id)
      }
    }

    if (added.size === 0 && changed.size === 0 && removed.size === 0) {
      return
    }

    const rebaseEntries = (entries: HistoryEntry[]): HistoryEntry[] =>
      entries.map((entry) => {
        const elements = new Map(entry.elements)
        for (const [id, element] of added) {
          elements.set(id, element)
        }
        for (const [id, element] of changed) {
          if (elements.has(id)) {
            elements.set(id, element)
          }
        }
        for (const id of removed) {
          elements.delete(id)
        }

        const selectedIds = new Set(entry.selectedIds)
        for (const id of removed) {
          selectedIds.delete(id)
        }

        return { elements, selectedIds, timestamp: entry.timestamp }
      })

    this.history = {
      ...this.history,
      redoStack: rebaseEntries(this.history.redoStack),
      undoStack: rebaseEntries(this.history.undoStack),
    }
  }

  /**
   * Set the container size used for screen↔canvas conversions.
   * @param width Container width in pixels.
   * @param height Container height in pixels.
   */
  setCanvasSize(width: number, height: number): void {
    this.canvasSize = { height, width }
  }

  /**
   * Switch the active drawing/selecting tool.
   * @param toolType Tool to activate.
   */
  setActiveTool(toolType: ToolType): void {
    const newTool = this.tools.get(toolType)
    if (!newTool || newTool === this.activeTool) {
      return
    }

    // A toolbar click or keyboard shortcut switching tools mid-edit must not
    // leave the editor orphaned; commit whatever was typed.
    this.onToolWillChange?.()

    this.activeTool.onDeactivate(this.createToolContext())
    this.activeTool = newTool
    this.snapGuides = []
    this.activeTool.onActivate(this.createToolContext())
    this.emit("toolChange", { tool: toolType })
  }

  /**
   * Get the currently active tool.
   */
  getActiveTool(): ToolType {
    return this.activeTool.type
  }

  /**
   * Get the current viewport state.
   */
  getViewport(): ViewportState {
    return this.viewport
  }

  /**
   * Set the viewport state and emit `viewportChange`.
   * @param viewport New viewport.
   */
  setViewport(viewport: ViewportState): void {
    this.viewport = viewport
    this.emit("viewportChange", { viewport: this.viewport })
  }

  /**
   * Get the current elements map. Caller should copy before storing.
   */
  getElements(): Map<ElementId, CanvasElement> {
    return this.elements
  }

  /**
   * Insert one or more media (image) elements, sizing them to fit the viewport.
   * By default the batch is stacked above every existing element.
   * @param descriptors Media input(s).
   * @param options `{ history }` to skip the checkpoint; `zIndex` to override
   * the base stacking index. Existing elements keep their indexes, so use a
   * value below them or call {@link sendToBack} to stack underneath.
   * @returns The created media elements.
   */
  insertMedia(
    descriptors: MediaInput | MediaInput[],
    options: { history?: boolean; zIndex?: number } = {},
  ): MediaElement[] {
    const inputs = Array.isArray(descriptors) ? descriptors : [descriptors]
    if (inputs.length === 0) {
      return []
    }
    if (options.zIndex !== undefined && !Number.isFinite(options.zIndex)) {
      throw new RangeError("insertMedia: zIndex must be a finite number")
    }

    const elements = createMediaElements(
      inputs,
      this.viewport,
      this.canvasSize,
      options.zIndex ?? getNextZIndex(this.elements.values()),
    )

    const insert = () => {
      for (const element of elements) {
        this.elements.set(element.id, element)
      }
      syncArrowBindings(this.elements)

      this.selectedIds = new Set(elements.map((elem) => elem.id))
      if (this.activeTool.type !== "select") {
        this.setActiveTool("select")
      }
    }

    if (options.history === false) {
      this.withoutHistory(insert)
    } else {
      insert()
      this.commitHistory()
    }

    this.emit("change", { elements: this.elements })
    this.emit("selectionChange", { selectedIds: this.selectedIds })
    return elements
  }

  // Add one or more elements to the canvas. Unlike mutating the Map returned
  // by `getElements()`, this pushes a history checkpoint (unless `history` is
  // false) and emits the usual `change` event, so the addition is undoable and
  // reactive bindings stay in sync.
  /**
   * Add one or more elements, pushing a history checkpoint (unless disabled)
   * and emitting `change`.
   * @param elements Element or elements to add.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The added elements.
   */
  addElement(
    elements: CanvasElement | CanvasElement[],
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    const inputs = Array.isArray(elements) ? elements : [elements]
    if (inputs.length === 0) {
      return []
    }

    const add = () => {
      for (const element of inputs) {
        this.elements.set(element.id, element)
      }
      syncArrowBindings(this.elements)
    }

    if (options.history === false) {
      this.withoutHistory(add)
    } else {
      add()
      this.commitHistory()
    }

    this.emit("change", { elements: this.elements })
    return inputs
  }

  // Replace the entire element set with the elements from a document. Emits
  // `change` (and `selectionChange`, since selection is cleared) so reactive
  // bindings and the DOM adapter re-render. By default a history checkpoint of
  // the previous state is pushed; pass `{ history: false }` to skip it.
  /**
   * Replace the element set with the contents of a document.
   * @param doc Document to load.
   * @param options `{ history }` to skip the checkpoint.
   */
  loadDocument(doc: CanvasDocument, options: { history?: boolean } = {}): void {
    const load = () => {
      const next = new Map<ElementId, CanvasElement>()
      for (const element of doc?.elements ?? []) {
        next.set(element.id, element)
      }
      this.elements = next
      syncArrowBindings(this.elements)
      this.selectedIds = new Set()
    }

    if (options.history === false) {
      this.withoutHistory(load)
    } else {
      load()
      this.commitHistory()
    }

    this.emit("change", { elements: this.elements })
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  // Serialize the current document. `exclude` filters which elements are
  // included without mutating canvas state. Returns a fresh, decoupled copy.
  /**
   * Serialize the current document. Returns a decoupled copy.
   * @param options `{ exclude }` filter.
   */
  toDocument(options: { exclude?: (element: CanvasElement) => boolean } = {}): {
    version: number
    elements: CanvasElement[]
  } {
    const elements = [...this.elements.values()]
      .filter((element) => !options.exclude?.(element))
      .map(cloneElementDeep)

    return {
      elements,
      version: DOCUMENT_VERSION,
    }
  }

  // Alias for `toDocument`; kept for symmetry with the original toJSON proposal.
  /**
   * Alias for {@link CanvasEngine.toDocument}.
   */
  toJSON(options: { exclude?: (element: CanvasElement) => boolean } = {}): {
    version: number
    elements: CanvasElement[]
  } {
    return this.toDocument(options)
  }

  // Replace the element set wholesale. Accepts either a Map or an array of
  // elements. Selection is intersected with the new IDs.
  /**
   * Replace the element set wholesale. Selection is intersected with new ids.
   * @param elements Map or array of elements.
   * @param options `{ history }` to skip the checkpoint.
   */
  setElements(
    elements: Map<ElementId, CanvasElement> | CanvasElement[],
    options: { history?: boolean } = {},
  ): void {
    const replace = () => {
      this.elements =
        elements instanceof Map
          ? new Map(elements)
          : new Map(elements.map((element) => [element.id, element]))
      syncArrowBindings(this.elements)
      this.selectedIds = new Set(
        [...this.selectedIds].filter((id) => this.elements.has(id)),
      )
    }

    if (options.history === false) {
      this.withoutHistory(replace)
    } else {
      replace()
      this.commitHistory()
    }

    this.emit("change", { elements: this.elements })
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  /**
   * Move one or more elements above every other element, preserving their
   * relative order. Group elements carry their children. Emits `change` and
   * pushes a history checkpoint unless `{ history: false }` is passed.
   * @param ids Element id or iterable of ids.
   * @param options `{ history }` to skip the checkpoint.
   */
  bringToFront(
    ids: ElementId | Iterable<ElementId>,
    options: { history?: boolean } = {},
  ): void {
    this.applyZOrder(
      (elements) => bringElementsToFront(elements, normalizeIds(ids)),
      options,
    )
  }

  /**
   * Move one or more elements below every other element, preserving their
   * relative order. Group elements carry their children. Emits `change` and
   * pushes a history checkpoint unless `{ history: false }` is passed.
   * @param ids Element id or iterable of ids.
   * @param options `{ history }` to skip the checkpoint.
   */
  sendToBack(
    ids: ElementId | Iterable<ElementId>,
    options: { history?: boolean } = {},
  ): void {
    this.applyZOrder(
      (elements) => sendElementsToBack(elements, normalizeIds(ids)),
      options,
    )
  }

  /**
   * Set one element's z-index to an exact value. Emits `change` and pushes a
   * history checkpoint unless `{ history: false }` is passed.
   * @param id Element id.
   * @param zIndex New stacking index.
   * @param options `{ history }` to skip the checkpoint.
   */
  setZIndex(
    id: ElementId,
    zIndex: number,
    options: { history?: boolean } = {},
  ): void {
    this.applyZOrder(
      (elements) => setElementZIndex(elements, id, zIndex),
      options,
    )
  }

  // Apply a z-order operation: swap in the new element map, record one
  // checkpoint unless skipped, and emit `change`. A null result means the
  // stack is already in the requested order, so nothing is recorded.
  private applyZOrder(
    operation: (
      elements: Map<ElementId, CanvasElement>,
    ) => Map<ElementId, CanvasElement> | null,
    options: { history?: boolean },
  ): void {
    const next = operation(this.elements)
    if (!next) {
      return
    }

    const apply = () => {
      this.elements = next
    }

    if (options.history === false) {
      this.withoutHistory(apply)
    } else {
      apply()
      this.commitHistory()
    }

    this.emit("change", { elements: this.elements })
  }

  /**
   * Get the current selection ids.
   */
  getSelectedIds(): Set<ElementId> {
    return this.selectedIds
  }

  /**
   * Get the current snapping configuration.
   */
  getSnappingConfig(): SnappingConfig {
    return this.snappingConfig
  }

  /**
   * Merge partial snapping configuration.
   * @param config Partial configuration.
   */
  setSnappingConfig(config: Partial<SnappingConfig>): void {
    this.snappingConfig = { ...this.snappingConfig, ...config }
  }

  // Snapping stays active without a modifier when `true`; otherwise it is
  // activated per-gesture by holding Ctrl/Cmd.
  /**
   * Whether snapping stays active without a modifier key.
   */
  getIsSnapMode(): boolean {
    return this.isSnapMode
  }

  /**
   * Toggle snap mode.
   * @param isSnapMode Whether snapping is always active.
   */
  setIsSnapMode(isSnapMode: boolean): void {
    this.isSnapMode = isSnapMode
  }

  // Guides from the in-progress snap gesture (empty when not snapped); the DOM
  // adapter renders them and headless consumers can read them.
  /**
   * Get guides from the in-progress snap gesture.
   */
  getSnapGuides(): SnapGuide[] {
    return this.snapGuides
  }

  /**
   * Get a tool's fully resolved style options, including defaults and the
   * engine's current global stroke color.
   *
   * @param tool Configurable tool identifier.
   * @returns Every option the tool uses, with defaults filled in.
   * @example
   * ```ts
   * canvas.getToolOptions("draw")
   * // { strokeColor, fillColor, strokeWidth: 2, smoothing: 0.5 }
   * ```
   */
  getToolOptions<T extends ConfigurableToolType>(
    tool: T,
  ): ResolvedToolOptions<T> {
    const overrides = this.toolOptions.get(tool) as
      | ToolOptionsMap[T]
      | undefined
    const resolved = resolveToolOptions(tool, overrides)
    if (overrides?.strokeColor === undefined) {
      resolved.strokeColor = this.strokeColor
    }
    return resolved
  }

  /**
   * Merge partial style options for a tool. Future elements created with the
   * tool use the new values, and matching elements in the current selection
   * are restyled immediately.
   *
   * @param tool Configurable tool identifier.
   * @param options Partial options to merge over the tool's current values.
   * @example
   * ```ts
   * canvas.setToolOptions("rectangle", { cornerRadius: 8, strokeWidth: 3 })
   * canvas.setToolOptions("text", { fontSize: 28 })
   * ```
   */
  setToolOptions<T extends ConfigurableToolType>(
    tool: T,
    options: ToolOptionsMap[T],
  ): void {
    const previous = this.toolOptions.get(tool) as ToolOptionsMap[T] | undefined
    const merged: Record<string, unknown> = { ...previous }
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) {
        merged[key] = value
      }
    }
    this.toolOptions.set(tool, merged as ToolOptionsMap[T])

    const changed = this.applyToolOptionsToSelection(
      tool,
      merged as ToolOptionsMap[T],
    )
    if (changed) {
      syncArrowBindings(this.elements)
      this.emit("change", { elements: this.elements })
      // Style changes can alter bounds (e.g. a text font size), so refresh
      // consumers that cache selection geometry.
      this.emit("selectionChange", { selectedIds: this.selectedIds })
    }

    this.emit("toolOptionsChange", {
      options: this.getToolOptions(tool),
      tool,
    } as ToolOptionsChangeEvent)
  }

  // Restyle selected elements that the given tool owns, ignoring other types.
  private applyToolOptionsToSelection<T extends ConfigurableToolType>(
    tool: T,
    options: ToolOptionsMap[T],
  ): boolean {
    if (this.selectedIds.size === 0) {
      return false
    }

    const elementType = getElementTypeForTool(tool)
    let changed = false
    for (const id of this.selectedIds) {
      const element = this.elements.get(id)
      if (!element || element.type !== elementType) {
        continue
      }
      const next = applyToolOptionsToElement(element, options)
      if (next !== element) {
        this.elements.set(id, next)
        changed = true
      }
    }
    return changed
  }

  /**
   * Set the active stroke color, applying it to the current selection. Clears
   * per-tool `strokeColor` overrides so every tool follows the new color.
   *
   * @param color Stroke color.
   */
  setStrokeColor(color: string): void {
    this.strokeColor = color

    for (const tool of CONFIGURABLE_TOOLS) {
      const overrides = this.toolOptions.get(tool)
      if (overrides?.strokeColor !== undefined) {
        const next = { ...overrides }
        delete next.strokeColor
        this.toolOptions.set(tool, next)
      }
    }

    if (this.selectedIds.size > 0) {
      for (const id of this.selectedIds) {
        const element = this.elements.get(id)
        if (element && "strokeColor" in element) {
          this.elements.set(id, { ...element, strokeColor: color })
        }
      }
    }

    this.emit("change", { elements: this.elements })
    for (const tool of CONFIGURABLE_TOOLS) {
      this.emit("toolOptionsChange", {
        options: this.getToolOptions(tool),
        tool,
      } as ToolOptionsChangeEvent)
    }
  }

  /**
   * Whether the transform overlay is hidden during transform gestures.
   */
  getHideOverlayWhileTransforming(): boolean {
    return this.hideOverlayWhileTransforming
  }

  /**
   * Set whether the transform overlay hides during transforms.
   * @param hide Hide flag.
   */
  setHideOverlayWhileTransforming(hide: boolean): void {
    this.hideOverlayWhileTransforming = hide
    // Re-render so the overlay reflects the change immediately (e.g. toggled
    // mid-gesture).
    this.renderRequested?.()
  }

  /**
   * Whether undo is currently possible.
   */
  canUndo(): boolean {
    return canUndo(this.history)
  }

  /**
   * Whether redo is currently possible.
   */
  canRedo(): boolean {
    return canRedo(this.history)
  }

  /**
   * Undo the last change.
   * @returns `true` if an undo was applied.
   */
  undo(): boolean {
    const result = undo(this.history, this.elements, this.selectedIds)
    if (result) {
      this.elements = result.elements
      syncArrowBindings(this.elements)
      this.selectedIds = result.selectedIds
      this.history = result.state
      this.emit("change", { elements: this.elements })
      this.emit("selectionChange", { selectedIds: this.selectedIds })
      return true
    }
    return false
  }

  /**
   * Redo the last undone change.
   * @returns `true` if a redo was applied.
   */
  redo(): boolean {
    const result = redo(this.history, this.elements, this.selectedIds)
    if (result) {
      this.elements = result.elements
      syncArrowBindings(this.elements)
      this.selectedIds = result.selectedIds
      this.history = result.state
      this.emit("change", { elements: this.elements })
      this.emit("selectionChange", { selectedIds: this.selectedIds })
      return true
    }
    return false
  }

  /**
   * Record the current canvas state as an undo checkpoint. No-op while inside
   * {@link CanvasEngine.withoutHistory}.
   */
  pushHistory(): void {
    this.commitHistory()
  }

  /**
   * Clear undo and redo history. The current canvas state becomes the new
   * baseline, so later edits are undoable but changes made before this call
   * are not. Emits `change` so reactive bindings refresh undo availability.
   */
  clearHistory(): void {
    this.history = pushHistory(
      createHistoryState(this.history.maxSize),
      this.elements,
      this.selectedIds,
    )
    this.emit("change", { elements: this.elements })
  }

  /**
   * Run a function without recording undo checkpoints. Changes made inside the
   * callback are folded into existing checkpoints, so undo/redo preserves them
   * instead of restoring a state that predates the callback. Nested calls are
   * coalesced; async callbacks keep history suppressed until they settle.
   * Returns the callback's result.
   *
   * @param fn Callback to run with history recording disabled.
   * @returns The callback's return value.
   */
  withoutHistory<T>(fn: () => T): T {
    const before = new Map(this.elements)
    this.historySuppressionDepth += 1

    const finish = (): void => {
      this.historySuppressionDepth -= 1
      if (this.historySuppressionDepth === 0) {
        this.rebaseHistory(before)
      }
    }

    try {
      const result = fn()
      if (isPromiseLike(result)) {
        return Promise.resolve(result).finally(finish) as T
      }
      finish()
      return result
    } catch (error) {
      finish()
      throw error
    }
  }

  /**
   * Where the canvas handles built-in keyboard shortcuts.
   */
  getKeyboardScope(): KeyboardScope {
    return this.keyboardScope
  }

  /**
   * Handle a keyboard shortcut event.
   * @param event Keyboard event.
   */
  handleKeyDown(event: KeyboardEvent): void {
    handleShortcutKey(event, this)
  }

  /**
   * Select all visible elements.
   */
  selectAll(): void {
    this.selectedIds = selectAllIds(this.elements)
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    this.selectedIds = new Set()
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  /**
   * Delete the selected elements.
   */
  deleteSelected(): void {
    const result = deleteSelectedElements(this.elements, this.selectedIds)
    if (!result) {
      return
    }
    this.elements = result.elements
    this.selectedIds = result.selectedIds
    this.commitHistory()
    this.emit("change", { elements: this.elements })
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  // Snapshot the selected elements (plus any grouped children) into the
  // in-memory clipboard. Returns an empty array when nothing is selected;
  // copying nothing never clears previously copied content.
  /**
   * Copy the selection (and grouped children) to the clipboard.
   * @returns Copied elements.
   */
  copy(): CanvasElement[] {
    const elements = collectClipboardElements(this.elements, this.selectedIds)
    if (elements.length > 0) {
      this.clipboard.write(elements)
    }
    return elements
  }

  // Copy the selection, then delete it as a single history step.
  /**
   * Copy the selection, then delete it.
   * @returns Copied elements.
   */
  cut(): CanvasElement[] {
    const copied = this.copy()
    if (copied.length > 0) {
      this.deleteSelected()
    }
    return copied
  }

  // Paste the clipboard centered on `at`, defaulting to the last pointer
  // position and then the viewport center. The pasted elements are selected and
  // the whole paste is one undo step.
  /**
   * Paste the clipboard centered on `at` (or last pointer / viewport center).
   * @param at Optional paste point in canvas coordinates.
   * @returns Pasted elements.
   */
  paste(at?: Point): CanvasElement[] {
    const copied = this.clipboard.read()
    if (copied.length === 0) {
      return []
    }

    const point = at ??
      this.pointerPoint ?? { x: this.viewport.x, y: this.viewport.y }
    const pasted = createPastedElements(
      copied,
      point,
      getNextZIndex(this.elements.values()),
    )

    for (const element of pasted) {
      this.elements.set(element.id, element)
    }
    syncArrowBindings(this.elements)
    this.selectedIds = new Set(pasted.map((element) => element.id))
    // Push after mutating so the top of the undo stack mirrors the pasted
    // state (same convention as the tools).
    this.commitHistory()

    this.emit("change", { elements: this.elements })
    this.emit("selectionChange", { selectedIds: this.selectedIds })
    if (this.activeTool.type !== "select") {
      this.setActiveTool("select")
    }
    return pasted
  }

  // Serialize the clipboard for the system clipboard; null when empty.
  /**
   * Serialize the clipboard to a string; null when empty.
   */
  serializeClipboard(): string | null {
    return this.clipboard.serialize()
  }

  // Replace the clipboard from serialized text; false when rejected.
  /**
   * Replace the clipboard from serialized text.
   * @param data Serialized clipboard data.
   * @returns Whether it was accepted.
   */
  deserializeClipboard(data: string): boolean {
    return this.clipboard.deserialize(data)
  }

  /**
   * Zoom in by one step around the origin.
   */
  zoomIn(): void {
    const center = { x: 0, y: 0 }
    this.viewport = zoomViewport(this.viewport, -100, center)
    this.emit("viewportChange", { viewport: this.viewport })
  }

  /**
   * Zoom out by one step around the origin.
   */
  zoomOut(): void {
    const center = { x: 0, y: 0 }
    this.viewport = zoomViewport(this.viewport, 100, center)
    this.emit("viewportChange", { viewport: this.viewport })
  }

  /**
   * Reset zoom to 1 and center to 0,0.
   */
  resetZoom(): void {
    this.viewport = resetViewport()
    this.emit("viewportChange", { viewport: this.viewport })
  }

  /**
   * Zoom and pan to fit all elements.
   */
  zoomToFit(): void {
    const bounds = getElementsBounds(this.elements)
    if (!bounds) {
      return
    }

    const viewport = computeZoomToFitViewport(bounds, this.canvasSize)
    if (!viewport) {
      return
    }

    this.viewport = viewport
    this.emit("viewportChange", { viewport: this.viewport })
  }

  /**
   * Get the active tool's temporary (in-progress) element.
   */
  getTemporaryElement(): CanvasElement | null {
    return this.activeTool.getTemporaryElement()
  }

  // Element currently highlighted as a binding candidate, or null. Driven by
  // the active tool (arrow drawing / arrow endpoint drag) and consumed by the
  // DOM adapter's highlight rendering.
  /** @internal */
  getBindingCandidate(): ElementId | null {
    return this.activeTool.getBindingCandidate?.() ?? null
  }

  /**
   * Subscribe to a canvas event.
   * @param event Event name.
   * @param listener Event handler.
   */
  on<K extends keyof CanvasEventMap>(
    event: K,
    listener: EventListener<K>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
  }

  /**
   * Unsubscribe from a canvas event.
   * @param event Event name.
   * @param listener Event handler.
   */
  off<K extends keyof CanvasEventMap>(
    event: K,
    listener: EventListener<K>,
  ): void {
    this.listeners.get(event)?.delete(listener)
  }

  /** @internal */
  emit<K extends keyof CanvasEventMap>(
    event: K,
    data: CanvasEventMap[K],
  ): void {
    this.listeners.get(event)?.forEach((listener) => {
      listener(data)
    })
  }

  // ── Adapter-facing internals (`engine/internal.ts` hooks) ──

  /** @internal */
  getActiveToolInstance(): Tool {
    return this.activeTool
  }

  /** @internal */
  getCanvasSize(): { width: number; height: number } {
    return this.canvasSize
  }

  /** @internal */
  getToolContext(): ToolContext {
    return this.createToolContext()
  }

  /** @internal */
  getPointerPoint(): Point | null {
    return this.pointerPoint
  }

  /** @internal */
  setSelectedIds(ids: Set<ElementId>): void {
    this.selectedIds = ids
    this.emit("selectionChange", { selectedIds: this.selectedIds })
  }

  /** @internal */
  setPointerPoint(point: Point): void {
    this.pointerPoint = point
  }

  /** @internal */
  setSnapGuides(guides: SnapGuide[]): void {
    this.snapGuides = guides
  }
}
