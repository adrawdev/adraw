import { clamp } from "../coordinates"
import { getElementsBounds, getNextZIndex } from "../elements"
import { getNoteMinHeight } from "../note"
import type { CanvasOptions, KeyboardScope, MediaInput } from "../options"
import { createSnappingConfig, type SnappingConfig } from "../snapping"
import { DEFAULT_STYLE, type StyleOptions } from "../style"
import {
  approximateTextMeasurer,
  measureTextElement,
  type TextLayout,
  type TextLayoutOptions,
  type TextMeasurer,
} from "../text"
import { findBoundText, isBoundTextContainer } from "../text-bindings"
import {
  createArrowTool,
  createDiamondTool,
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
import { Scene, type SceneChange, type SceneDraft } from "./scene"
import { deleteSelectedElements, selectAllIds } from "./selection"
import { handleShortcutKey } from "./shortcuts"
import { notifyState, runStateOperation } from "./state-notifier"
import { applyStyleToElement, getElementStyle } from "./style"
import {
  bringElementsToFront,
  sendElementsToBack,
  setElementZIndex,
} from "./z-order"

const DOCUMENT_VERSION = 1

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

// Re-measure every text/note element in place with the active measurer.
// Returns whether any element box changed.
function remeasureElements(
  elements: Map<ElementId, CanvasElement>,
  measurer: TextMeasurer,
): boolean {
  let changed = false
  for (const [id, element] of elements) {
    if (element.type === "note") {
      const minHeight = getNoteMinHeight(element, measurer)
      if (minHeight > element.height) {
        elements.set(id, { ...element, height: minHeight })
        changed = true
      }
      continue
    }
    if (element.type !== "text") {
      continue
    }
    const layout = measureTextElement(element, measurer)
    if (layout.width === element.width && layout.height === element.height) {
      continue
    }
    elements.set(id, {
      ...element,
      height: layout.height,
      width: layout.width,
    })
    changed = true
  }
  return changed
}

// Headless canvas engine: pure state (elements, selection, viewport, tools,
// history) plus the state notifier. No DOM — a DOM adapter (see `dom/`) drives
// it through the public API and the `/** @internal */` hooks below.
/**
 * Headless canvas engine: pure state (elements, selection, viewport, tools,
 * history) plus the internal state notifier. No DOM. A DOM adapter drives it
 * via the public API and the `@internal` hooks.
 */
export class CanvasEngine {
  private readonly scene: Scene
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
  private isToolLocked: boolean
  private clipboard: ClipboardManager
  // Last pointer position in canvas space, tracked by the dispatch helpers so
  // keyboard paste can land at the cursor.
  private pointerPoint: Point | null = null
  private canvasSize: { width: number; height: number } = {
    height: 0,
    width: 0,
  }
  private tools = new Map<ToolType, Tool>()

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
    this.isToolLocked = options.isToolLocked ?? false
    this.scene = new Scene({ getTextMeasurer: () => this.textMeasurer })

    this.tools.set("select", createSelectTool())
    this.tools.set("hand", createHandTool())
    this.tools.set("rectangle", createRectangleTool())
    this.tools.set("ellipse", createEllipseTool())
    this.tools.set("diamond", createDiamondTool())
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
      const initialElements = new Map<ElementId, CanvasElement>()
      for (const element of initial) {
        const copy = cloneElementDeep(element)
        initialElements.set(copy.id, copy)
      }
      remeasureElements(initialElements, this.textMeasurer)
      this.scene.replace(initialElements, { selection: "clear" })
      this.scene.clearHistory()
    }
  }

  private createToolContext(): ToolContext {
    return {
      finishCreation: () => {
        if (this.isToolLocked) {
          this.setSelectedIds(new Set())
          return
        }
        this.setActiveTool("select")
      },
      getCanvasSize: () => this.canvasSize,
      getElements: () => this.scene.getElements(),
      getIsSnapMode: () => this.isSnapMode,
      getSelectedIds: () => this.scene.getSelectedIds(),
      getSnappingConfig: () => this.snappingConfig,
      getStyle: () => this.style,
      getViewport: () => this.viewport,
      measureText: (text, options) => this.textMeasurer(text, options),
      pushHistory: () => {
        this.pushHistory()
      },
      setActiveTool: (tool) => this.setActiveTool(tool),
      setElements: (elements) => {
        runStateOperation(this, () => {
          this.publishSceneChange(this.scene.replace(elements))
        })
      },
      setSelectedIds: (ids) => {
        this.setSelectedIds(ids)
      },
      setSnapGuides: (guides) => {
        this.snapGuides = guides
      },
      setViewport: (viewport) => {
        runStateOperation(this, () => {
          this.viewport = viewport
          notifyState(this, "viewport")
        })
      },
    }
  }

  // Publish the state kinds represented by a scene change.
  private publishSceneChange(change: SceneChange): void {
    if (change.elementsChanged) {
      notifyState(this, "elements")
    }
    if (change.selectionChanged) {
      notifyState(this, "selection")
    }
    if (change.historyChanged) {
      notifyState(this, "history")
    }
  }

  // Public mutations opt into a checkpoint. `{ history: false }` also rebases
  // the change into existing checkpoints, so undo/redo preserves it.
  private commitSceneWithHistory(
    mutator: (draft: SceneDraft) => void,
    history: boolean | undefined,
  ): SceneChange {
    if (history === false) {
      return this.scene.withoutHistory(() =>
        this.scene.commit(mutator, { history: false }),
      )
    }
    return this.scene.commit(mutator, { history: true })
  }

  private replaceSceneWithHistory(
    elements: Map<ElementId, CanvasElement>,
    history: boolean | undefined,
    selection?: "clear" | "keep" | Iterable<ElementId>,
  ): SceneChange {
    if (history === false) {
      return this.scene.withoutHistory(() =>
        this.scene.replace(elements, { history: false, selection }),
      )
    }
    return this.scene.replace(elements, { history: true, selection })
  }

  /**
   * Apply a scene commit and publish the resulting state changes.
   * @internal
   */
  commitScene(
    mutator: (draft: {
      elements: Map<ElementId, CanvasElement>
      selectedIds: Set<ElementId>
    }) => void,
    options: { history?: boolean } = {},
  ): void {
    runStateOperation(this, () => {
      this.publishSceneChange(this.scene.commit(mutator, options))
    })
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
    runStateOperation(this, () => {
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
      notifyState(this, "tool")
    })
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
   * Set the viewport state and notify state subscribers. The zoom is clamped to
   * the configured range and, when `constrainToContent` is enabled, the pan is
   * clamped so content stays in view.
   * @param viewport New viewport.
   */
  setViewport(viewport: ViewportState): void {
    runStateOperation(this, () => {
      this.viewport = this.constrainViewport(viewport)
      notifyState(this, "viewport")
    })
  }

  // Clamp zoom to the configured range plus the last-fit floor, then keep
  // content in view when requested.
  private constrainViewport(viewport: ViewportState): ViewportState {
    const bounds = this.viewportConfig.constrainToContent
      ? (this.contentBoundsOverride ??
        getElementsBounds(this.scene.getElements()))
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
    return this.scene.getElements()
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
    return runStateOperation(this, () => {
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
        options.zIndex ?? getNextZIndex(this.scene.getElements().values()),
      )

      const change = this.commitSceneWithHistory((draft) => {
        for (const element of elements) {
          draft.elements.set(element.id, element)
        }
        draft.selectedIds = new Set(elements.map((element) => element.id))
      }, options.history)

      if (this.activeTool.type !== "select") {
        this.setActiveTool("select")
      }
      this.publishSceneChange(change)
      return elements
    })
  }

  // Add one or more elements to the canvas. Unlike mutating the Map returned
  // by `getElements()`, this pushes a history checkpoint (unless `history` is
  // false) and publishes the element change, so the addition is undoable and
  // reactive bindings stay in sync.
  /**
   * Add one or more elements, pushing a history checkpoint (unless disabled)
   * and publishing the change.
   * @param elements Element or elements to add.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The added elements.
   */
  addElement(
    elements: CanvasElement | CanvasElement[],
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    return runStateOperation(this, () => {
      const inputs = Array.isArray(elements) ? elements : [elements]
      if (inputs.length === 0) {
        return []
      }

      const change = this.commitSceneWithHistory((draft) => {
        for (const element of inputs) {
          draft.elements.set(element.id, element)
        }
      }, options.history)

      this.publishSceneChange(change)
      return inputs
    })
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
    runStateOperation(this, () => {
      const next = new Map<ElementId, CanvasElement>()
      for (const element of doc?.elements ?? []) {
        next.set(element.id, element)
      }
      remeasureElements(next, this.textMeasurer)
      const change = this.replaceSceneWithHistory(
        next,
        options.history,
        "clear",
      )
      this.publishSceneChange(change)
      if (!change.selectionChanged) {
        notifyState(this, "selection")
      }
    })
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
    const elements = [...this.scene.getElements().values()]
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
    runStateOperation(this, () => {
      const next =
        elements instanceof Map
          ? new Map(elements)
          : new Map(elements.map((element) => [element.id, element]))
      const change = this.replaceSceneWithHistory(next, options.history)
      this.publishSceneChange(change)
      if (!change.selectionChanged) {
        notifyState(this, "selection")
      }
    })
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
    runStateOperation(this, () => {
      this.applyZOrder(
        (elements) => bringElementsToFront(elements, normalizeIds(ids)),
        options,
      )
    })
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
    runStateOperation(this, () => {
      this.applyZOrder(
        (elements) => sendElementsToBack(elements, normalizeIds(ids)),
        options,
      )
    })
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
    runStateOperation(this, () => {
      this.applyZOrder(
        (elements) => setElementZIndex(elements, id, zIndex),
        options,
      )
    })
  }

  // Apply a z-order operation: swap in the new element map, record one
  // checkpoint unless skipped, and publish the change. A null result means the
  // stack is already in the requested order, so nothing is recorded.
  private applyZOrder(
    operation: (
      elements: Map<ElementId, CanvasElement>,
    ) => Map<ElementId, CanvasElement> | null,
    options: { history?: boolean },
  ): void {
    const next = operation(this.scene.getElements())
    if (!next) {
      return
    }

    const change = this.replaceSceneWithHistory(next, options.history)
    this.publishSceneChange(change)
  }

  /**
   * Get the current selection ids.
   */
  getSelectedIds(): Set<ElementId> {
    return this.scene.getSelectedIds()
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
    runStateOperation(this, () => {
      this.snappingConfig = { ...this.snappingConfig, ...config }
      notifyState(this, "snapping")
    })
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
    runStateOperation(this, () => {
      this.isSnapMode = isSnapMode
      notifyState(this, "snapping")
    })
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
    runStateOperation(this, () => {
      this.textMeasurer = measurer ?? approximateTextMeasurer
      this.textMeasurerSource = measurer ? "custom" : "default"
      this.remeasureTextElements()
    })
  }

  /**
   * Re-measure every text element with the active measurer. Call this after
   * custom web fonts finish loading so text boxes track the new metrics.
   */
  refreshTextMetrics(): void {
    runStateOperation(this, () => {
      this.remeasureTextElements()
    })
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
    runStateOperation(this, () => {
      this.textMeasurer = measurer
      this.textMeasurerSource = "adapter"
      this.remeasureTextElements()
    })
  }

  /**
   * Restore the built-in measurer when the DOM adapter is torn down.
   * @internal
   */
  resetTextMeasurer(): void {
    runStateOperation(this, () => {
      if (this.textMeasurerSource !== "adapter") {
        return
      }
      this.textMeasurer = approximateTextMeasurer
      this.textMeasurerSource = "default"
      this.remeasureTextElements()
    })
  }

  // Recompute every text element's box with the active measurer. Silent during
  // construction/load so callers can publish a single elements change.
  private remeasureTextElements(emit = true): boolean {
    const change = this.scene.commit(
      (draft) => {
        remeasureElements(draft.elements, this.textMeasurer)
      },
      { history: false },
    )

    if (change.elementsChanged && emit) {
      notifyState(this, "elements")
      notifyState(this, "selection")
    }
    return change.elementsChanged
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
    runStateOperation(this, () => {
      const entries = Object.entries(options).filter(
        ([, value]) => value !== undefined,
      )
      this.style = {
        ...this.style,
        ...(Object.fromEntries(entries) as StyleOptions),
      }

      if (this.scene.getSelectedIds().size === 0) {
        notifyState(this, "style")
        return
      }

      const change = this.scene.commit(
        (draft) => {
          this.applyStyleToSelection(
            draft.elements,
            draft.selectedIds,
            this.style,
          )
        },
        { history: false },
      )

      this.publishSceneChange(change)
      notifyState(this, "style")
    })
  }

  // Style of the current selection, reduced to fields every selected element
  // agrees on. Returns null when nothing usable is selected.
  private getSelectionStyle(): StyleOptions | null {
    const selectedIds = this.scene.getSelectedIds()
    if (selectedIds.size === 0) {
      return null
    }

    const elements = this.scene.getElements()
    const styles: StyleOptions[] = []
    for (const id of selectedIds) {
      const element = elements.get(id)
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
  private applyStyleToSelection(
    elements: Map<ElementId, CanvasElement>,
    selectedIds: Set<ElementId>,
    options: StyleOptions,
  ): boolean {
    if (selectedIds.size === 0) {
      return false
    }

    const targets = new Set<ElementId>(selectedIds)
    for (const id of selectedIds) {
      const element = elements.get(id)
      if (!isBoundTextContainer(element)) {
        continue
      }
      const label = findBoundText(elements, id)
      if (label) {
        targets.add(label.id)
      }
    }

    let changed = false
    for (const id of targets) {
      const element = elements.get(id)
      if (!element) {
        continue
      }
      const next = applyStyleToElement(element, options, this.textMeasurer)
      if (next !== element) {
        elements.set(id, next)
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
    runStateOperation(this, () => {
      this.hideOverlayWhileTransforming = hide
      notifyState(this, "overlay")
    })
  }

  /**
   * Whether the active drawing tool is locked, i.e. stays active after
   * creating an element.
   */
  getIsToolLocked(): boolean {
    return this.isToolLocked
  }

  /**
   * Lock the active drawing tool so it stays active after creating an element.
   * Applies to the rectangle, ellipse, diamond, line, arrow, text and note
   * tools; the draw and eraser tools always stay active.
   *
   * @param locked Whether to keep the current tool instead of switching to
   * `"select"`.
   */
  setIsToolLocked(locked: boolean): void {
    runStateOperation(this, () => {
      this.isToolLocked = locked
      notifyState(this, "toolLock")
    })
  }

  /**
   * Whether undo is currently possible.
   */
  canUndo(): boolean {
    return this.scene.canUndo()
  }

  /**
   * Whether redo is currently possible.
   */
  canRedo(): boolean {
    return this.scene.canRedo()
  }

  /**
   * Undo the last change.
   * @returns `true` if an undo was applied.
   */
  undo(): boolean {
    return runStateOperation(this, () => {
      const change = this.scene.undo()
      if (!change.elementsChanged) {
        return false
      }
      this.publishSceneChange(change)
      return true
    })
  }

  /**
   * Redo the last undone change.
   * @returns `true` if a redo was applied.
   */
  redo(): boolean {
    return runStateOperation(this, () => {
      const change = this.scene.redo()
      if (!change.elementsChanged) {
        return false
      }
      this.publishSceneChange(change)
      return true
    })
  }

  /**
   * Record the current canvas state as an undo checkpoint. No-op while inside
   * {@link CanvasEngine.withoutHistory}.
   */
  pushHistory(): void {
    runStateOperation(this, () => {
      this.publishSceneChange(this.scene.checkpoint())
    })
  }

  /**
   * Clear undo and redo history. The current canvas state becomes the new
   * baseline, so later edits are undoable but changes made before this call
   * are not.
   */
  clearHistory(): void {
    runStateOperation(this, () => {
      this.publishSceneChange(this.scene.clearHistory())
    })
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
    return runStateOperation(this, () => {
      let result: T
      try {
        result = this.scene.withoutHistory(fn)
      } catch (error) {
        notifyState(this, "history")
        throw error
      }

      if (isPromiseLike(result)) {
        return Promise.resolve(result).then(
          (value) => {
            runStateOperation(this, () => {
              notifyState(this, "history")
            })
            return value
          },
          (error: unknown) => {
            try {
              runStateOperation(this, () => {
                notifyState(this, "history")
              })
            } catch {
              // Preserve the operation rejection over a listener failure.
            }
            throw error
          },
        ) as T
      }

      notifyState(this, "history")
      return result
    })
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
    runStateOperation(this, () => {
      handleShortcutKey(event, this)
    })
  }

  /**
   * Select all visible elements.
   */
  selectAll(): void {
    runStateOperation(this, () => {
      const ids = selectAllIds(this.scene.getElements())
      this.publishSceneChange(this.scene.select(ids))
    })
  }

  /**
   * Clear the current selection.
   */
  clearSelection(): void {
    runStateOperation(this, () => {
      this.publishSceneChange(this.scene.select(new Set()))
    })
  }

  /**
   * Delete the selected elements.
   */
  deleteSelected(): void {
    runStateOperation(this, () => {
      const result = deleteSelectedElements(
        this.scene.getElements(),
        this.scene.getSelectedIds(),
      )
      if (!result) {
        return
      }
      const change = this.scene.replace(result.elements, {
        history: true,
        selection: result.selectedIds,
      })
      this.publishSceneChange(change)
    })
  }

  // Snapshot the selected elements (plus any grouped children) into the
  // in-memory clipboard. Returns an empty array when nothing is selected;
  // copying nothing never clears previously copied content.
  /**
   * Copy the selection (and grouped children) to the clipboard.
   * @returns Copied elements.
   */
  copy(): CanvasElement[] {
    const elements = collectClipboardElements(
      this.scene.getElements(),
      this.scene.getSelectedIds(),
    )
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
    return runStateOperation(this, () => {
      const copied = this.copy()
      if (copied.length > 0) {
        this.deleteSelected()
      }
      return copied
    })
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
    return runStateOperation(this, () => {
      const copied = this.clipboard.read()
      if (copied.length === 0) {
        return []
      }

      const point = at ??
        this.pointerPoint ?? { x: this.viewport.x, y: this.viewport.y }
      const pasted = createPastedElements(
        copied,
        point,
        getNextZIndex(this.scene.getElements().values()),
      )

      const change = this.scene.commit(
        (draft) => {
          for (const element of pasted) {
            draft.elements.set(element.id, element)
          }
          draft.selectedIds = new Set(pasted.map((element) => element.id))
        },
        { history: true },
      )

      this.publishSceneChange(change)
      if (this.activeTool.type !== "select") {
        this.setActiveTool("select")
      }
      return pasted
    })
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
    runStateOperation(this, () => {
      const center = { x: this.viewport.x, y: this.viewport.y }
      this.setViewport(
        zoomViewport(this.viewport, -100, center, this.viewportConfig),
      )
    })
  }

  /**
   * Zoom out by one step around the viewport center.
   */
  zoomOut(): void {
    runStateOperation(this, () => {
      const center = { x: this.viewport.x, y: this.viewport.y }
      this.setViewport(
        zoomViewport(this.viewport, 100, center, this.viewportConfig),
      )
    })
  }

  /**
   * Reset zoom to 1 and center to 0,0. With `constrainToContent` enabled the
   * zoom floor and pan constraint still apply.
   */
  resetZoom(): void {
    runStateOperation(this, () => {
      this.setViewport(resetViewport())
    })
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
    runStateOperation(this, () => {
      const bounds =
        options.bounds ?? getElementsBounds(this.scene.getElements())
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
    })
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

  // ── Adapter-facing internals (`engine/internal.ts` hooks) ──

  /**
   * Whether the canvas is mounted into a DOM container. Headless engines
   * return `false`; {@link AdrawCanvas} overrides this.
   */
  isMounted(): boolean {
    return false
  }

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
    runStateOperation(this, () => {
      this.publishSceneChange(this.scene.select(ids))
    })
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
