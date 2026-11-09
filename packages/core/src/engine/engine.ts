import { detachArrowsOutsideSelection } from "../arrow-bindings"
import { clamp } from "../coordinates"
import { getElementsBounds, getNextZIndex } from "../elements"
import {
  collectSubtreeIds,
  createGroupIndex,
  getAffectedIds,
  getContextChain,
  getLeafDescendantIds,
  groupSelection,
  isEffectivelyLocked,
  isEffectivelyVisible,
  resolveContextChain,
  syncGroupState,
  ungroupSelection,
  type GroupIndex,
} from "../groups"
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
  Alignment,
  CanvasDocument,
  CanvasElement,
  DistributeAxis,
  ElementId,
  GroupElement,
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
  createClonedElements,
  createPastedElements,
} from "./clipboard"
import { createMediaElements } from "./media"
import { Scene, type SceneChange, type SceneDraft } from "./scene"
import { deleteSelectedElements, selectAllIds } from "./selection"
import { handleShortcutKey } from "./shortcuts"
import { notifyState, runStateOperation } from "./state-notifier"
import { applyStyleToElement, getElementStyle } from "./style"
import {
  applyElementPatch,
  translateElement,
  validateElementPatch,
  type ElementPatch,
  type ElementUpdate,
  type ElementUpdateResult,
} from "./update"
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

function normalizeUpdates(
  updates: readonly ElementUpdate[] | ReadonlyMap<ElementId, ElementPatch>,
): ElementUpdate[] {
  if (updates instanceof Map) {
    return [...updates].map(([id, patch]) => ({ id, patch }))
  }
  if (!Array.isArray(updates)) {
    throw new TypeError(
      "updateElements: expected an array of updates or a Map of ids to patches",
    )
  }
  return [...updates]
}

function sameSelection(a: Set<ElementId>, b: Set<ElementId>): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false
    }
  }
  return true
}

const ALIGNMENTS = new Set<Alignment>([
  "left",
  "center",
  "right",
  "top",
  "middle",
  "bottom",
])

const DISTRIBUTE_AXES = new Set<DistributeAxis>(["horizontal", "vertical"])

const TRANSFORM_EPSILON = 1e-9

function isZeroDelta(delta: Point): boolean {
  return (
    Math.abs(delta.x) < TRANSFORM_EPSILON &&
    Math.abs(delta.y) < TRANSFORM_EPSILON
  )
}

function hasSelectedAncestor(
  index: GroupIndex,
  id: ElementId,
  selected: Set<ElementId>,
): boolean {
  const seen = new Set<ElementId>()
  let current = index.parentById.get(id)
  while (current && !seen.has(current)) {
    if (selected.has(current)) {
      return true
    }
    seen.add(current)
    current = index.parentById.get(current)
  }
  return false
}

function getCombinedBounds(targets: CanvasElement[]): {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
} {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const target of targets) {
    left = Math.min(left, target.x)
    right = Math.max(right, target.x + target.width)
    top = Math.min(top, target.y)
    bottom = Math.max(bottom, target.y + target.height)
  }
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  }
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
  // Group the select tool is currently inside. Transient interaction state, not
  // part of the document or the store snapshot.
  private groupContextId: ElementId | null = null
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
      getGroupContext: () => this.groupContextId,
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
      setGroupContext: (id) => {
        this.setGroupContext(id)
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
      this.reconcileGroupContext()
      notifyState(this, "elements")
    }
    if (change.selectionChanged) {
      notifyState(this, "selection")
    }
    if (change.historyChanged) {
      notifyState(this, "history")
    }
  }

  // Drop the entered-group context when its group disappears, hides, or locks.
  private reconcileGroupContext(): void {
    const contextId = this.groupContextId
    if (!contextId) {
      return
    }

    const elements = this.scene.getElements()
    const group = elements.get(contextId)
    if (group?.type !== "group") {
      this.groupContextId = null
      return
    }

    const index = createGroupIndex(elements)
    if (
      !isEffectivelyVisible(index, contextId) ||
      isEffectivelyLocked(index, contextId)
    ) {
      this.groupContextId = null
    }
  }

  // Rebuild the entered-group context from the selection after undo/redo. Keep
  // the current context when the selection is empty and it is still valid.
  private reconstructGroupContext(): void {
    const elements = this.scene.getElements()
    const selectedIds = this.scene.getSelectedIds()
    const index = createGroupIndex(elements)

    if (selectedIds.size > 0) {
      const parents = new Set<ElementId | null>()
      for (const id of selectedIds) {
        if (elements.has(id)) {
          parents.add(index.parentById.get(id) ?? null)
        }
      }
      this.groupContextId =
        parents.size === 1 ? ([...parents][0] ?? null) : null
      return
    }

    const contextId = this.groupContextId
    if (
      contextId &&
      elements.get(contextId)?.type === "group" &&
      isEffectivelyVisible(index, contextId) &&
      !isEffectivelyLocked(index, contextId)
    ) {
      return
    }
    this.groupContextId = null
  }

  /**
   * The group the select tool is currently inside.
   * @internal
   */
  getGroupContext(): ElementId | null {
    return this.groupContextId
  }

  /**
   * Set or clear the entered group. Invalid ids clear the context.
   * @internal
   */
  setGroupContext(id: ElementId | null): void {
    if (!id) {
      this.groupContextId = null
      return
    }

    const elements = this.scene.getElements()
    const group = elements.get(id)
    if (group?.type !== "group") {
      this.groupContextId = null
      return
    }

    const index = createGroupIndex(elements)
    this.groupContextId =
      isEffectivelyVisible(index, id) && !isEffectivelyLocked(index, id)
        ? id
        : null
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

      // Entering a group is a select-tool interaction; leaving the tool exits
      // the context.
      this.groupContextId = null

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

  /**
   * Update one element with a validated partial patch.
   *
   * The patch can only contain fields the element type owns; `id` and `type`
   * are immutable. Derived fields are rejected: line, arrow and path bounds,
   * free text height, group bounds and rotation, and the position, size, lock
   * state and visibility of bound text. Arrow bindings, bound text and group
   * bounds are re-synchronized after the patch.
   *
   * @param id Element id.
   * @param patch Fields to update.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The updated element, or `null` when the id is unknown.
   * @example
   * ```ts
   * canvas.updateElement("rect-1", { fillColor: "#ffd43b", strokeWidth: 3 })
   * ```
   */
  updateElement(
    id: ElementId,
    patch: ElementPatch,
    options: { history?: boolean } = {},
  ): CanvasElement | null {
    const [updated] = this.updateElements([{ id, patch }], options).updated
    return updated ?? null
  }

  /**
   * Update several elements atomically with validated partial patches.
   *
   * Every patch is validated and applied in one scene commit, so an invalid
   * patch leaves the canvas unchanged. The batch records one history checkpoint
   * and publishes one snapshot. Duplicate ids are rejected; unknown ids are
   * reported in `missing` and do not fail the batch.
   *
   * @param updates Array of `{ id, patch }` entries, or a map of ids to patches.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The updated elements and the ids that were not found.
   * @example
   * ```ts
   * const { updated, missing } = canvas.updateElements([
   *   { id: "rect-1", patch: { x: 40 } },
   *   { id: "text-1", patch: { text: "Hello" } },
   * ])
   * ```
   */
  updateElements(
    updates: readonly ElementUpdate[] | ReadonlyMap<ElementId, ElementPatch>,
    options: { history?: boolean } = {},
  ): ElementUpdateResult {
    return runStateOperation(this, () => {
      const entries = normalizeUpdates(updates)
      const seen = new Set<ElementId>()
      for (const entry of entries) {
        if (!entry || typeof entry.id !== "string") {
          throw new TypeError(
            "updateElements: every update needs a string element id",
          )
        }
        if (seen.has(entry.id)) {
          throw new TypeError(
            `updateElements: duplicate update for "${entry.id}"`,
          )
        }
        seen.add(entry.id)
      }

      const current = this.scene.getElements()
      const applicable: ElementUpdate[] = []
      const missing: ElementId[] = []
      for (const entry of entries) {
        if (current.has(entry.id)) {
          applicable.push(entry)
        } else {
          missing.push(entry.id)
        }
      }

      if (applicable.length === 0) {
        return { missing, updated: [] }
      }

      const change = this.commitSceneWithHistory((draft) => {
        for (const entry of applicable) {
          const element = draft.elements.get(entry.id)
          if (!element) {
            continue
          }
          validateElementPatch(draft.elements, element, entry.patch)
          applyElementPatch(
            draft.elements,
            element,
            entry.patch,
            this.textMeasurer,
          )
        }
      }, options.history)

      this.publishSceneChange(change)

      const elements = this.scene.getElements()
      const updated: CanvasElement[] = []
      for (const entry of applicable) {
        const element = elements.get(entry.id)
        if (element) {
          updated.push(element)
        }
      }
      return { missing, updated }
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
      this.groupContextId = null
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
    const elements = new Map<ElementId, CanvasElement>()
    for (const element of this.scene.getElements().values()) {
      if (!options.exclude?.(element)) {
        elements.set(element.id, cloneElementDeep(element))
      }
    }
    // Excluding a group child must not leave a dangling reference in the saved
    // document, so prune the cloned copy before returning it.
    syncGroupState(elements)

    return {
      elements: [...elements.values()],
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
      this.groupContextId = null
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
   * Set one element's z-index to an exact value. A group is stacked as a unit:
   * its descendants shift so the topmost child lands on the requested index.
   * Emits `change` and pushes a history checkpoint unless `{ history: false }`
   * is passed.
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
   * Lock or unlock elements. Locked elements stay visible and exportable but
   * are skipped by hit-testing, marquee selection and `selectAll`. Locking a
   * group locks its descendants through inherited state; descendant flags are
   * not rewritten. Locking removes the affected elements from the current
   * selection.
   *
   * @param ids Element id or iterable of ids.
   * @param locked Whether the elements should be locked.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targeted elements that exist, after the update.
   * @example
   * ```ts
   * canvas.setLocked("rect-1", true)
   * canvas.setLocked(["rect-1", "note-1"], false)
   * ```
   */
  setLocked(
    ids: ElementId | Iterable<ElementId>,
    locked: boolean,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    return this.setElementFlag(ids, "locked", locked, options)
  }

  /**
   * Show or hide elements. Hidden elements are not rendered, hit-tested,
   * marquee-selected or exported. Hiding a group hides its descendants through
   * inherited state; descendant flags are not rewritten. Hiding removes the
   * affected elements from the current selection.
   *
   * Bound text visibility is derived from its container: call `setVisible` on
   * the container or group instead of on the bound text.
   *
   * @param ids Element id or iterable of ids.
   * @param visible Whether the elements should be visible.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targeted elements that exist, after the update.
   * @example
   * ```ts
   * canvas.setVisible("rect-1", false)
   * canvas.setVisible("rect-1", true)
   * ```
   */
  setVisible(
    ids: ElementId | Iterable<ElementId>,
    visible: boolean,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    return this.setElementFlag(ids, "visible", visible, options)
  }

  /**
   * Flip the `locked` flag of each targeted element. Inherited lock state from
   * a group ancestor still applies.
   *
   * @param ids Element id or iterable of ids.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targeted elements that exist, after the update.
   */
  toggleLocked(
    ids: ElementId | Iterable<ElementId>,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    return this.setElementFlag(ids, "locked", null, options)
  }

  /**
   * Flip the `visible` flag of each targeted element. Hiding removes the
   * affected elements from the current selection. Bound text visibility is
   * derived from its container, so it cannot be toggled directly.
   *
   * @param ids Element id or iterable of ids.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targeted elements that exist, after the update.
   */
  toggleVisible(
    ids: ElementId | Iterable<ElementId>,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    return this.setElementFlag(ids, "visible", null, options)
  }

  // Set or toggle one boolean flag on the targeted elements, prune hidden or
  // locked subtrees from the selection, and publish one coherent change.
  private setElementFlag(
    ids: ElementId | Iterable<ElementId>,
    flag: "locked" | "visible",
    value: boolean | null,
    options: { history?: boolean },
  ): CanvasElement[] {
    return runStateOperation(this, () => {
      const targets = [...new Set(normalizeIds(ids))]
      if (targets.length === 0) {
        return []
      }

      const current = this.scene.getElements()
      const applicable: ElementId[] = []
      for (const id of targets) {
        const element = current.get(id)
        if (!element) {
          continue
        }
        if (
          element.type === "text" &&
          element.containerId !== null &&
          element.containerId !== undefined
        ) {
          const flagName = flag === "locked" ? "lock state" : "visibility"
          throw new TypeError(
            `Bound text ${flagName} is derived from its container; set it on the container instead`,
          )
        }
        applicable.push(id)
      }
      if (applicable.length === 0) {
        return []
      }

      const restrictedRoots: ElementId[] = []
      const change = this.commitSceneWithHistory((draft) => {
        for (const id of applicable) {
          const element = draft.elements.get(id)
          if (!element) {
            continue
          }
          const nextValue = value === null ? !element[flag] : value
          if (element[flag] !== nextValue) {
            draft.elements.set(id, { ...element, [flag]: nextValue })
          }
          if (
            (flag === "locked" && nextValue) ||
            (flag === "visible" && !nextValue)
          ) {
            restrictedRoots.push(id)
          }
        }

        if (restrictedRoots.length === 0) {
          return
        }

        const index = createGroupIndex(draft.elements)
        const restricted = collectSubtreeIds(index, restrictedRoots)
        const boundTextByContainer = new Map<ElementId, ElementId[]>()
        for (const element of draft.elements.values()) {
          if (element.type === "text" && element.containerId) {
            const list = boundTextByContainer.get(element.containerId) ?? []
            list.push(element.id)
            boundTextByContainer.set(element.containerId, list)
          }
        }
        const textTargets: ElementId[] = []
        for (const id of restricted) {
          for (const textId of boundTextByContainer.get(id) ?? []) {
            textTargets.push(textId)
          }
        }
        for (const id of textTargets) {
          restricted.add(id)
        }
        for (const id of restricted) {
          draft.selectedIds.delete(id)
        }
      }, options.history)

      this.publishSceneChange(change)

      const elements = this.scene.getElements()
      const updated: CanvasElement[] = []
      for (const id of applicable) {
        const element = elements.get(id)
        if (element) {
          updated.push(element)
        }
      }
      return updated
    })
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
    const index = createGroupIndex(elements)
    const styles: StyleOptions[] = []
    for (const id of getLeafDescendantIds(index, selectedIds)) {
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

  // Restyle every selected element that supports the given options. Bound text
  // attached to a selected container is included so text styles reach it too.
  private applyStyleToSelection(
    elements: Map<ElementId, CanvasElement>,
    selectedIds: Set<ElementId>,
    options: StyleOptions,
  ): boolean {
    if (selectedIds.size === 0) {
      return false
    }

    const index = createGroupIndex(elements)
    const targets = getLeafDescendantIds(index, selectedIds)
    const boundTextAdditions: ElementId[] = []
    for (const id of targets) {
      const element = elements.get(id)
      if (!isBoundTextContainer(element)) {
        continue
      }
      const boundText = findBoundText(elements, id)
      if (boundText) {
        boundTextAdditions.push(boundText.id)
      }
    }
    for (const id of boundTextAdditions) {
      targets.add(id)
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
      this.reconstructGroupContext()
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
      this.reconstructGroupContext()
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
   * Run several mutations as one undo step.
   *
   * The callback runs as one canvas operation: nested engine calls record no
   * intermediate history checkpoints, and the store publishes one coherent
   * snapshot when the outermost batch finishes. Nested `batch` calls join the
   * outer batch. The callback must be synchronous.
   *
   * With `{ history: false }`, the batch records no checkpoint and folds its
   * changes into existing checkpoints, like
   * {@link CanvasEngine.withoutHistory}. This only applies to the outermost
   * batch: a nested batch inherits the outer batch's history mode. If the
   * callback throws, changes made so far stay on the canvas, are recorded as
   * one checkpoint when history is enabled, and are published before the error
   * is rethrown. There is no rollback.
   *
   * @param fn Callback containing the mutations.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The callback's return value.
   * @example
   * ```ts
   * canvas.batch(() => {
   *   const [rect] = canvas.addElement(rectangle)
   *   canvas.updateElement(rect.id, { fillColor: "#ffd43b" })
   *   canvas.setLocked(rect.id, true)
   * })
   * ```
   */
  batch<T>(fn: () => T, options: { history?: boolean } = {}): T {
    return runStateOperation(this, () => {
      if (options.history === false && !this.scene.isBatching()) {
        return this.scene.withoutHistory(() => this.runBatch(fn))
      }
      return this.runBatch(fn)
    })
  }

  // Run a synchronous callback with intermediate checkpoints suppressed and
  // record one checkpoint for the outermost batch if anything observable
  // changed. Errors still record the partial work so undo can revert it.
  private runBatch<T>(fn: () => T): T {
    const beforeElements = this.scene.getElements()
    const beforeSelection = new Set(this.scene.getSelectedIds())
    this.scene.beginBatch()
    try {
      const result = fn()
      if (isPromiseLike(result)) {
        throw new TypeError("batch: callback must be synchronous")
      }
      return result
    } finally {
      const isOuter = this.scene.endBatch()
      if (isOuter) {
        const selectionChanged = !sameSelection(
          beforeSelection,
          this.scene.getSelectedIds(),
        )
        if (this.scene.getElements() !== beforeElements || selectionChanged) {
          this.publishSceneChange(this.scene.checkpoint())
        }
      }
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
    runStateOperation(this, () => {
      handleShortcutKey(event, this)
    })
  }

  /**
   * Select all visible elements. At the top level this selects top-level
   * groups, not their children; inside an entered group it selects that
   * group's direct children.
   */
  selectAll(): void {
    runStateOperation(this, () => {
      const ids = selectAllIds(this.scene.getElements(), this.groupContextId)
      this.publishSceneChange(this.scene.select(ids))
    })
  }

  /**
   * Clear the current selection and leave any entered group.
   */
  clearSelection(): void {
    runStateOperation(this, () => {
      this.groupContextId = null
      this.publishSceneChange(this.scene.select(new Set()))
    })
  }

  /**
   * Leave the entered group one level, selecting the group that was left, or
   * clear the selection at the top level.
   * @internal
   */
  escapeSelection(): void {
    runStateOperation(this, () => {
      const contextId = this.groupContextId
      if (contextId) {
        const elements = this.scene.getElements()
        const index = createGroupIndex(elements)
        const group = elements.get(contextId)
        if (
          group?.type === "group" &&
          isEffectivelyVisible(index, contextId) &&
          !isEffectivelyLocked(index, contextId)
        ) {
          this.groupContextId = index.parentById.get(contextId) ?? null
          this.publishSceneChange(this.scene.select(new Set([contextId])))
          return
        }
      }

      this.groupContextId = null
      this.publishSceneChange(this.scene.select(new Set()))
    })
  }

  /**
   * Delete the selected elements. A selected group deletes its whole subtree;
   * a selected child inside a group removes only that child.
   */
  deleteSelected(): void {
    runStateOperation(this, () => {
      const elements = this.scene.getElements()
      const index = createGroupIndex(elements)
      const contextChain = getContextChain(index, this.groupContextId)
      const result = deleteSelectedElements(
        elements,
        this.scene.getSelectedIds(),
      )
      if (!result) {
        return
      }
      const change = this.scene.replace(result.elements, {
        history: true,
        selection: result.selectedIds,
      })
      this.groupContextId = resolveContextChain(
        this.scene.getElements(),
        contextChain,
      )
      this.publishSceneChange(change)
    })
  }

  /**
   * Group the current selection. Requires at least two top-level objects;
   * returns the created group, or null when nothing changed. The new group is
   * selected and the selection's shared parent becomes the entered context.
   *
   * @returns The created group, or null.
   * @example
   * ```ts
   * canvas.setSelectedIds(new Set([rect.id, ellipse.id]))
   * const group = canvas.group()
   * ```
   */
  group(): GroupElement | null {
    return runStateOperation(this, () => {
      const result = groupSelection(
        this.scene.getElements(),
        this.scene.getSelectedIds(),
      )
      if (!result.group) {
        return null
      }

      const groupId = result.group.id
      const change = this.scene.replace(result.elements, {
        history: true,
        selection: new Set([groupId]),
      })
      this.groupContextId = result.parentId
      this.publishSceneChange(change)

      const group = this.scene.getElements().get(groupId)
      return group?.type === "group" ? group : null
    })
  }

  /**
   * Ungroup the selected groups, one level. The released children are selected
   * and nested groups stay intact.
   *
   * @returns The released child ids, or an empty array when nothing changed.
   * @example
   * ```ts
   * canvas.setSelectedIds(new Set([groupId]))
   * canvas.ungroup()
   * ```
   */
  ungroup(): ElementId[] {
    return runStateOperation(this, () => {
      const elements = this.scene.getElements()
      const selectedIds = this.scene.getSelectedIds()
      const index = createGroupIndex(elements)
      const contextChain = getContextChain(index, this.groupContextId)
      const result = ungroupSelection(elements, selectedIds)
      if (result.removedGroupIds.length === 0) {
        return []
      }

      const change = this.scene.replace(result.elements, {
        history: true,
        selection: new Set(result.releasedIds),
      })
      this.groupContextId = resolveContextChain(
        this.scene.getElements(),
        contextChain,
      )
      this.publishSceneChange(change)

      const next = this.scene.getElements()
      return result.releasedIds.filter((id) => next.has(id))
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

  /**
   * Duplicate elements with fresh ids.
   *
   * Defaults to the current selection and includes group descendants and bound
   * text. Group references, bound-text containers and arrow bindings are
   * remapped to the clones; bindings to elements outside the duplicated set are
   * dropped. Clones are offset by 20,20 unless `offset` is provided, stack above
   * the existing content, become the selection, and the whole call is one undo
   * step unless `{ history: false }` is passed.
   *
   * @param ids Element id or iterable of ids; defaults to the current selection.
   * @param options `{ offset, history }`.
   * @returns The cloned elements.
   * @example
   * ```ts
   * canvas.duplicate()
   * canvas.duplicate("rect-1", { offset: { x: 10, y: 0 } })
   * ```
   */
  duplicate(
    ids?: ElementId | Iterable<ElementId>,
    options: { offset?: Point; history?: boolean } = {},
  ): CanvasElement[] {
    return runStateOperation(this, () => {
      const sourceIds =
        ids === undefined
          ? this.scene.getSelectedIds()
          : new Set(normalizeIds(ids))
      const source = collectClipboardElements(
        this.scene.getElements(),
        sourceIds,
      )
      if (source.length === 0) {
        return []
      }

      const offset = options.offset ?? { x: 20, y: 20 }
      if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) {
        throw new RangeError("duplicate: offset must contain finite numbers")
      }

      const clones = createClonedElements(
        source,
        offset,
        getNextZIndex(this.scene.getElements().values()),
      )
      const change = this.commitSceneWithHistory((draft) => {
        for (const clone of clones) {
          draft.elements.set(clone.id, clone)
        }
        draft.selectedIds = new Set(clones.map((element) => element.id))
      }, options.history)

      // Duplicated elements are top-level until explicitly grouped.
      this.groupContextId = null
      this.publishSceneChange(change)
      return clones
    })
  }

  /**
   * Move elements by a delta.
   *
   * Defaults to the current selection. Groups move their whole subtree; paths
   * translate their points; lines and arrows translate their endpoints; bound
   * text follows its container. Arrow bindings whose targets are outside the
   * moving set detach like a direct drag. One history checkpoint unless
   * `{ history: false }` is passed.
   *
   * @param ids Element id or iterable of ids; defaults to the current selection.
   * @param delta Translation in canvas units.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targeted elements after the move.
   */
  nudge(
    ids: ElementId | Iterable<ElementId> | undefined,
    delta: Point,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
      throw new RangeError("nudge: delta must contain finite numbers")
    }
    if (delta.x === 0 && delta.y === 0) {
      return []
    }

    return runStateOperation(this, () => {
      const elements = this.scene.getElements()
      const selected =
        ids === undefined
          ? this.scene.getSelectedIds()
          : new Set(normalizeIds(ids))
      const targets = [...selected].filter((id) => elements.has(id))
      if (targets.length === 0) {
        return []
      }

      const index = createGroupIndex(elements)
      const affected = getAffectedIds(index, targets)
      const leaves = getLeafDescendantIds(index, targets)
      const change = this.commitSceneWithHistory((draft) => {
        detachArrowsOutsideSelection(draft.elements, affected)
        for (const id of leaves) {
          const element = draft.elements.get(id)
          if (!element) {
            continue
          }
          // Bound text follows its container; translating it here would be
          // undone by the binding sync.
          if (element.type === "text" && element.containerId) {
            continue
          }
          draft.elements.set(id, translateElement(element, delta))
        }
      }, options.history)

      this.publishSceneChange(change)

      const next = this.scene.getElements()
      const moved: CanvasElement[] = []
      for (const id of targets) {
        const element = next.get(id)
        if (element) {
          moved.push(element)
        }
      }
      return moved
    })
  }

  /**
   * Align visible, unlocked elements to an edge or center of their combined
   * bounds.
   *
   * Bound text follows its container and is not an independent target; locked
   * or hidden elements are skipped and do not contribute to the bounds. Groups
   * move as a unit. Arrow bindings whose targets stay outside the moving set
   * detach like a direct drag. One history checkpoint is recorded unless
   * `{ history: false }` is passed.
   *
   * @param ids Element id or iterable of ids; defaults to the current selection.
   * @param alignment Edge or center to align to.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targets after alignment.
   * @example
   * ```ts
   * canvas.align(["rect-1", "rect-2"], "left")
   * canvas.align(undefined, "middle") // current selection
   * ```
   */
  align(
    ids: ElementId | Iterable<ElementId> | undefined,
    alignment: Alignment,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    if (!ALIGNMENTS.has(alignment)) {
      throw new TypeError(`align: unknown alignment "${alignment}"`)
    }

    return this.transformTargets(ids, options, (targets) => {
      const deltas = new Map<ElementId, Point>()
      if (targets.length < 2) {
        return deltas
      }

      const bounds = getCombinedBounds(targets)
      for (const target of targets) {
        let x = 0
        let y = 0
        switch (alignment) {
          case "left": {
            x = bounds.left - target.x
            break
          }
          case "center": {
            x = bounds.left + bounds.width / 2 - (target.x + target.width / 2)
            break
          }
          case "right": {
            x = bounds.right - (target.x + target.width)
            break
          }
          case "top": {
            y = bounds.top - target.y
            break
          }
          case "middle": {
            y = bounds.top + bounds.height / 2 - (target.y + target.height / 2)
            break
          }
          case "bottom": {
            y = bounds.bottom - (target.y + target.height)
            break
          }
        }
        deltas.set(target.id, { x, y })
      }
      return deltas
    })
  }

  /**
   * Distribute three or more elements evenly along an axis.
   *
   * The first and last targets by center on the axis stay fixed and the gaps
   * between all targets are equalized. Bound text follows its container and is
   * not an independent target; locked or hidden elements are skipped. Groups
   * move as a unit. One history checkpoint is recorded unless
   * `{ history: false }` is passed.
   *
   * @param ids Element id or iterable of ids; defaults to the current selection.
   * @param axis Axis to distribute along.
   * @param options `{ history }` to skip the checkpoint.
   * @returns The targets after distribution.
   * @example
   * ```ts
   * canvas.distribute(["rect-1", "rect-2", "rect-3"], "horizontal")
   * ```
   */
  distribute(
    ids: ElementId | Iterable<ElementId> | undefined,
    axis: DistributeAxis,
    options: { history?: boolean } = {},
  ): CanvasElement[] {
    if (!DISTRIBUTE_AXES.has(axis)) {
      throw new TypeError(`distribute: unknown axis "${axis}"`)
    }

    return this.transformTargets(ids, options, (targets) => {
      const deltas = new Map<ElementId, Point>()
      if (targets.length < 3) {
        return deltas
      }

      const sorted = targets.toSorted((a, b) => {
        const aCenter =
          axis === "horizontal" ? a.x + a.width / 2 : a.y + a.height / 2
        const bCenter =
          axis === "horizontal" ? b.x + b.width / 2 : b.y + b.height / 2
        return aCenter - bCenter
      })
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const start = axis === "horizontal" ? first.x : first.y
      const end =
        axis === "horizontal" ? last.x + last.width : last.y + last.height
      const total = sorted.reduce(
        (sum, target) =>
          sum + (axis === "horizontal" ? target.width : target.height),
        0,
      )
      const gap = (end - start - total) / (sorted.length - 1)

      let cursor = start
      for (const target of sorted) {
        if (axis === "horizontal") {
          deltas.set(target.id, { x: cursor - target.x, y: 0 })
          cursor += target.width + gap
        } else {
          deltas.set(target.id, { x: 0, y: cursor - target.y })
          cursor += target.height + gap
        }
      }
      return deltas
    })
  }

  /**
   * Nudge the current selection by a delta. Used by the arrow-key shortcuts.
   * @internal
   */
  nudgeSelection(dx: number, dy: number): void {
    this.nudge(undefined, { x: dx, y: dy })
  }

  /**
   * Whether the canvas has a non-empty selection.
   * @internal
   */
  hasSelection(): boolean {
    return this.scene.getSelectedIds().size > 0
  }

  private transformTargets(
    ids: ElementId | Iterable<ElementId> | undefined,
    options: { history?: boolean },
    compute: (targets: CanvasElement[]) => Map<ElementId, Point>,
  ): CanvasElement[] {
    return runStateOperation(this, () => {
      const elements = this.scene.getElements()
      const { index, targets } = this.resolveTransformTargets(ids, elements)
      if (targets.length === 0) {
        return []
      }

      const deltas = compute(targets)
      let changed = false
      for (const delta of deltas.values()) {
        if (!isZeroDelta(delta)) {
          changed = true
          break
        }
      }
      if (!changed) {
        return targets
      }

      const targetIds = targets.map((target) => target.id)
      const affected = getAffectedIds(index, targetIds)
      const change = this.commitSceneWithHistory((draft) => {
        detachArrowsOutsideSelection(draft.elements, affected)
        this.applyTargetDeltas(draft, targetIds, deltas, index)
      }, options.history)

      this.publishSceneChange(change)

      const next = this.scene.getElements()
      return targetIds
        .map((id) => next.get(id))
        .filter((element): element is CanvasElement => Boolean(element))
    })
  }

  private resolveTransformTargets(
    ids: ElementId | Iterable<ElementId> | undefined,
    elements: Map<ElementId, CanvasElement>,
  ): { index: GroupIndex; targets: CanvasElement[] } {
    const selected =
      ids === undefined
        ? this.scene.getSelectedIds()
        : new Set(normalizeIds(ids))
    const index = createGroupIndex(elements)
    const targets: CanvasElement[] = []
    for (const id of selected) {
      const element = elements.get(id)
      if (!element) {
        continue
      }
      if (!isEffectivelyVisible(index, id) || isEffectivelyLocked(index, id)) {
        continue
      }
      // Bound text follows its container and is not independently movable.
      if (element.type === "text" && element.containerId) {
        continue
      }
      if (hasSelectedAncestor(index, id, selected)) {
        continue
      }
      targets.push(element)
    }
    return { index, targets }
  }

  private applyTargetDeltas(
    draft: SceneDraft,
    targetIds: ElementId[],
    deltas: Map<ElementId, Point>,
    index: GroupIndex,
  ): void {
    for (const id of targetIds) {
      const delta = deltas.get(id)
      if (!delta || isZeroDelta(delta)) {
        continue
      }
      const element = draft.elements.get(id)
      if (!element) {
        continue
      }
      if (element.type === "group") {
        for (const leafId of getLeafDescendantIds(index, [id])) {
          const leaf = draft.elements.get(leafId)
          if (!leaf) {
            continue
          }
          if (leaf.type === "text" && leaf.containerId) {
            continue
          }
          draft.elements.set(leafId, translateElement(leaf, delta))
        }
      } else {
        if (element.type === "text" && element.containerId) {
          continue
        }
        draft.elements.set(id, translateElement(element, delta))
      }
    }
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

      // Pasted elements are top-level until explicitly grouped.
      this.groupContextId = null
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
