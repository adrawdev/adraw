import { syncArrowBindings } from "../bindings"
import { clamp } from "../coordinates"
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
import { getNoteMinHeight } from "../note"
import type {
  CanvasEventMap,
  CanvasOptions,
  KeyboardScope,
  MediaInput,
} from "../options"
import { createSnappingConfig, type SnappingConfig } from "../snapping"
import { DEFAULT_STYLE, type StyleOptions } from "../style"
import {
  approximateTextMeasurer,
  measureTextElement,
  type TextLayout,
  type TextLayoutOptions,
  type TextMeasurer,
} from "../text"
import {
  findBoundText,
  isBoundTextContainer,
  syncTextBindings,
} from "../text-bindings"
import {
  createArrowTool,
  createDrawTool,
  createEllipseTool,
  createEraserTool,
  createHandTool,
  createLineTool,
  createNoteTool,
  createRectangleTool,
  createSelectTool,
  createTextTool,
} from "../tools"
import { type Tool, type ToolContext } from "../tools/base"
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
import {
  constrainViewportToBounds,
  createViewport,
  normalizeViewportBounds,
  resetViewport,
  resolveViewportConfig,
  type ViewportConfig,
  zoomToFit as fitViewport,
  type ZoomToFitOptions,
  zoomViewport,
} from "../viewport"
import {
  ClipboardManager,
  cloneElementDeep,
  collectClipboardElements,
  createPastedElements,
} from "./clipboard"
import { createMediaElements } from "./media"
import { deleteSelectedElements, selectAllIds } from "./selection"
import { handleShortcutKey } from "./shortcuts"
import { applyStyleToElement, getElementStyle } from "./style"
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

// Reduce several styles to the fields they all share with the same value.
function getCommonStyle(styles: StyleOptions[]): StyleOptions {
  const first = styles[0]
  if (!first) {
    return {}
  }

  const common: Record<string, unknown> = { ...first }
  for (const style of styles.slice(1)) {
    const record = style as Record<string, unknown>
    for (const key of Object.keys(common)) {
      if (record[key] !== common[key]) {
        delete common[key]
      }
    }
  }
  return common as StyleOptions
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
  /**
   * Get the fully resolved viewport configuration.
   */
  getViewportConfig: () => ViewportConfig
  setPointerPoint: (point: Point) => void
  /**
   * Get the text measurer currently used to size text elements.
   */
  getTextMeasurer: () => TextMeasurer
  /**
   * Measure text with the current measurer.
   */
  measureText: (text: string, options: TextLayoutOptions) => TextLayout
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
  private readonly viewportConfig: ViewportConfig
  // Zoom of the last explicit fit. While `constrainToContent` is enabled it
  // acts as the effective minimum zoom, so the user cannot zoom out past the
  // content they fitted.
  private contentFitZoom: number | null = null
  // Bounds supplied to the last `zoomToFit({ bounds })`; while set, the
  // constrainToContent pan clamp uses them instead of the live element bounds.
  private contentBoundsOverride: {
    bottom: number
    left: number
    right: number
    top: number
  } | null = null
  private activeTool: Tool
  private snappingConfig: SnappingConfig
  private isSnapMode: boolean
  private keyboardScope: KeyboardScope
  // Text layout measurer. The DOM adapter installs a canvas-backed one on
  // mount; the headless default approximates metrics without touching the DOM.
  private textMeasurer: TextMeasurer
  private textMeasurerSource: "adapter" | "custom" | "default"
  private snapGuides: SnapGuide[] = []
  // Global style overrides set with `setStyle`; tools merge them over their
  // own defaults for future gestures.
  private style: StyleOptions = {}
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
    this.viewportConfig = resolveViewportConfig(options.viewport)
    this.viewport = createViewport(options.initialViewport, this.viewportConfig)
    this.clipboard = new ClipboardManager(options.clipboard)
    this.snappingConfig = createSnappingConfig(options.snapping)
    this.isSnapMode = options.isSnapMode ?? false
    this.keyboardScope = options.keyboard ?? "canvas"
    this.textMeasurer = options.measureText ?? approximateTextMeasurer
    this.textMeasurerSource = options.measureText ? "custom" : "default"
    this.hideOverlayWhileTransforming =
      options.hideOverlayWhileTransforming ?? false

    this.tools.set("select", createSelectTool())
    this.tools.set("hand", createHandTool())
    this.tools.set("rectangle", createRectangleTool())
    this.tools.set("ellipse", createEllipseTool())
    this.tools.set("line", createLineTool())
    this.tools.set("arrow", createArrowTool())
    this.tools.set("draw", createDrawTool())
    this.tools.set("eraser", createEraserTool())
    this.tools.set("text", createTextTool())
    this.tools.set("note", createNoteTool())

    this.activeTool = this.tools.get("select")!
    this.activeTool.onActivate(this.createToolContext())

    // Load initial content before seeding the history baseline so the first
    // undo cannot remove the document the engine was created with.
    const initial = options.initialDocument
      ? (options.initialDocument.elements ?? [])
      : options.initialElements
    if (initial?.length) {
      this.elements = new Map<ElementId, CanvasElement>()
      for (const element of initial) {
        const copy = cloneElementDeep(element)
        this.elements.set(copy.id, copy)
      }
      this.remeasureTextElements(false)
      this.syncBindings()
    }

    // Seed the baseline checkpoint so the first edit can be undone back to the
    // initial canvas. The top of the undo stack always mirrors the current
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
      getStyle: () => this.style,
      getViewport: () => this.viewport,
      measureText: (text, options) => this.textMeasurer(text, options),
      pushHistory: () => {
        this.commitHistory()
      },
      setActiveTool: (tool) => this.setActiveTool(tool),
      setElements: (elements) => {
        this.elements = elements
        this.syncBindings()
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

  // Recompute derived bindings after elements move: arrow endpoints follow
  // their targets, then bound text follows its container (and may grow it).
  // A grown container can move arrow endpoints again, so arrows sync twice.
  // Removes labels whose container disappeared and drops them from selection.
  private syncBindings(): boolean {
    let changed = syncArrowBindings(this.elements)
    const textChanged = syncTextBindings(this.elements, this.textMeasurer)
    if (textChanged) {
      changed = true
      syncArrowBindings(this.elements)
      if (this.selectedIds.size > 0) {
        const next = new Set(
          [...this.selectedIds].filter((id) => this.elements.has(id)),
        )
        if (next.size !== this.selectedIds.size) {
          this.selectedIds = next
          this.emit("selectionChange", { selectedIds: this.selectedIds })
        }
      }
    }
    return changed
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
   * Get the fully resolved viewport configuration.
   */
  getViewportConfig(): ViewportConfig {
    return { ...this.viewportConfig }
  }

  /**
   * Set the viewport state and emit `viewportChange`. The zoom is clamped to
   * the configured range and, when `constrainToContent` is enabled, the pan is
   * clamped so content stays in view.
   * @param viewport New viewport.
   */
  setViewport(viewport: ViewportState): void {
    this.viewport = this.constrainViewport(viewport)
    this.emit("viewportChange", { viewport: this.viewport })
  }

  // Clamp zoom to the configured range plus the last-fit floor, then keep
  // content in view when requested.
  private constrainViewport(viewport: ViewportState): ViewportState {
    const bounds = this.viewportConfig.constrainToContent
      ? (this.contentBoundsOverride ?? getElementsBounds(this.elements))
      : null
    const minZoom =
      bounds && this.contentFitZoom !== null
        ? Math.max(this.viewportConfig.minZoom, this.contentFitZoom)
        : this.viewportConfig.minZoom

    const zoom = clamp(viewport.zoom, minZoom, this.viewportConfig.maxZoom)
    const clamped = zoom === viewport.zoom ? viewport : { ...viewport, zoom }

    if (!bounds) {
      return clamped
    }

    return constrainViewportToBounds(clamped, bounds, this.canvasSize)
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
      this.syncBindings()

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
      this.syncBindings()
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
      this.remeasureTextElements(false)
      this.syncBindings()
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
      this.syncBindings()
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
   * Get the text measurer used to size and wrap text elements.
   *
   * @returns The active measurer.
   */
  getTextMeasurer(): TextMeasurer {
    return this.textMeasurer
  }

  /**
   * Measure text with the engine's current measurer. Useful for adapters that
   * need the exact box a text element will have before creating it.
   *
   * @param text Source text.
   * @param options Font metrics and wrapping options.
   * @returns Box size and wrapped lines.
   */
  measureText(text: string, options: TextLayoutOptions): TextLayout {
    return this.textMeasurer(text, options)
  }

  /**
   * Replace the text measurer and re-measure every text element. Pass `null`
   * to restore the built-in approximation.
   *
   * @param measurer New measurer, or `null` for the default.
   * @example
   * ```ts
   * canvas.setTextMeasurer((text, options) => measureTextLayout(text, options))
   * ```
   */
  setTextMeasurer(measurer: TextMeasurer | null): void {
    this.textMeasurer = measurer ?? approximateTextMeasurer
    this.textMeasurerSource = measurer ? "custom" : "default"
    this.remeasureTextElements()
  }

  /**
   * Re-measure every text element with the active measurer. Call this after
   * custom web fonts finish loading so text boxes track the new metrics.
   */
  refreshTextMetrics(): void {
    this.remeasureTextElements()
  }

  /**
   * Whether the engine is still using its built-in measurer.
   * @internal
   */
  usesDefaultTextMeasurer(): boolean {
    return this.textMeasurerSource === "default"
  }

  /**
   * Install the DOM adapter's measurer on mount.
   * @internal
   */
  setAdapterTextMeasurer(measurer: TextMeasurer): void {
    this.textMeasurer = measurer
    this.textMeasurerSource = "adapter"
    this.remeasureTextElements()
  }

  /**
   * Restore the built-in measurer when the DOM adapter is torn down.
   * @internal
   */
  resetTextMeasurer(): void {
    if (this.textMeasurerSource !== "adapter") {
      return
    }
    this.textMeasurer = approximateTextMeasurer
    this.textMeasurerSource = "default"
    this.remeasureTextElements()
  }

  // Recompute every text element's box with the active measurer. Silent during
  // construction/load so callers can emit a single change event.
  private remeasureTextElements(emit = true): boolean {
    let changed = false
    for (const [id, element] of this.elements) {
      if (element.type === "note") {
        const minHeight = getNoteMinHeight(element, this.textMeasurer)
        if (minHeight > element.height) {
          this.elements.set(id, { ...element, height: minHeight })
          changed = true
        }
        continue
      }
      if (element.type !== "text") {
        continue
      }
      const layout = measureTextElement(element, this.textMeasurer)
      if (layout.width === element.width && layout.height === element.height) {
        continue
      }
      this.elements.set(id, {
        ...element,
        height: layout.height,
        width: layout.width,
      })
      changed = true
    }

    if (changed && emit) {
      this.syncBindings()
      this.emit("change", { elements: this.elements })
      this.emit("selectionChange", { selectedIds: this.selectedIds })
    }
    return changed
  }

  /**
   * Get the effective style options for the current context. The selected
   * elements win; otherwise the global style is returned. When several elements
   * are selected, only the fields they agree on are returned.
   *
   * @returns Style options for the selection or the global style.
   * @example
   * ```ts
   * canvas.selectAll()
   * canvas.getStyle() // style of the selected elements
   *
   * canvas.clearSelection()
   * canvas.getStyle() // global style
   * ```
   */
  getStyle(): StyleOptions {
    return this.getSelectionStyle() ?? this.getGlobalStyle()
  }

  /**
   * Merge partial style options into the global style. Future elements created
   * with any tool use the new values, and matching elements in the current
   * selection are restyled immediately. Options that an element does not
   * support are ignored, so shared values such as `strokeWidth` reach every
   * drawing element while `smoothing`, `cornerRadius` or the text options only
   * reach the elements that use them.
   *
   * @param options Partial style options to merge over the global style.
   * @example
   * ```ts
   * canvas.setStyle({ opacity: 0.5, strokeColor: "#f00", strokeWidth: 3 })
   * canvas.setStyle({ fillColor: "#ffd43b", cornerRadius: 8 })
   * canvas.setStyle({ fontSize: 28, smoothing: 0.8 })
   * ```
   */
  setStyle(options: StyleOptions): void {
    const entries = Object.entries(options).filter(
      ([, value]) => value !== undefined,
    )
    this.style = {
      ...this.style,
      ...(Object.fromEntries(entries) as StyleOptions),
    }

    if (this.applyStyleToSelection(this.style)) {
      this.syncBindings()
      this.emit("change", { elements: this.elements })
      // Style changes can alter bounds (e.g. a text font size), so refresh
      // consumers that cache selection geometry.
      this.emit("selectionChange", { selectedIds: this.selectedIds })
    }
  }

  // Style of the current selection, reduced to fields every selected element
  // agrees on. Returns null when nothing usable is selected.
  private getSelectionStyle(): StyleOptions | null {
    if (this.selectedIds.size === 0) {
      return null
    }

    const styles: StyleOptions[] = []
    for (const id of this.selectedIds) {
      const element = this.elements.get(id)
      if (element) {
        styles.push(getElementStyle(element))
      }
    }
    return styles.length > 0 ? getCommonStyle(styles) : null
  }

  // Global style: built-in defaults overlaid with the values set by
  // `setStyle`.
  private getGlobalStyle(): StyleOptions {
    return { ...DEFAULT_STYLE, ...this.style }
  }

  // Restyle every selected element that supports the given options. Labels
  // bound to a selected container are included so text styles reach them too.
  private applyStyleToSelection(options: StyleOptions): boolean {
    if (this.selectedIds.size === 0) {
      return false
    }

    const targets = new Set<ElementId>(this.selectedIds)
    for (const id of this.selectedIds) {
      const element = this.elements.get(id)
      if (!isBoundTextContainer(element)) {
        continue
      }
      const label = findBoundText(this.elements, id)
      if (label) {
        targets.add(label.id)
      }
    }

    let changed = false
    for (const id of targets) {
      const element = this.elements.get(id)
      if (!element) {
        continue
      }
      const next = applyStyleToElement(element, options, this.textMeasurer)
      if (next !== element) {
        this.elements.set(id, next)
        changed = true
      }
    }
    return changed
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
    this.syncBindings()
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
    this.syncBindings()
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
   * Zoom in by one step around the viewport center.
   */
  zoomIn(): void {
    const center = { x: this.viewport.x, y: this.viewport.y }
    this.setViewport(
      zoomViewport(this.viewport, -100, center, this.viewportConfig),
    )
  }

  /**
   * Zoom out by one step around the viewport center.
   */
  zoomOut(): void {
    const center = { x: this.viewport.x, y: this.viewport.y }
    this.setViewport(
      zoomViewport(this.viewport, 100, center, this.viewportConfig),
    )
  }

  /**
   * Reset zoom to 1 and center to 0,0. With `constrainToContent` enabled the
   * zoom floor and pan constraint still apply.
   */
  resetZoom(): void {
    this.setViewport(resetViewport())
  }

  /**
   * Zoom and pan to fit content, clamped to the configured zoom range.
   *
   * @param options Optional padding in screen pixels (defaults to
   * `viewport.fitPadding`) and explicit bounds (defaults to all visible
   * elements). Explicit bounds also become the region used by
   * `constrainToContent` until the next fit.
   */
  zoomToFit(options: ZoomToFitOptions = {}): void {
    const bounds = options.bounds ?? getElementsBounds(this.elements)
    if (!bounds) {
      return
    }

    const padding = Math.max(
      0,
      options.padding ?? this.viewportConfig.fitPadding,
    )
    const viewport = fitViewport(
      this.viewport,
      bounds,
      this.canvasSize,
      padding,
      this.viewportConfig,
    )
    if (viewport === this.viewport) {
      return
    }

    // Record the fit bounds and zoom before applying them so the constraint
    // accepts the fit and later pan/zoom-outs use the same content region.
    this.contentBoundsOverride = options.bounds
      ? normalizeViewportBounds(options.bounds)
      : null
    this.contentFitZoom = viewport.zoom
    this.setViewport(viewport)
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
