import {
  NOTE_CORNER_RADIUS,
  NOTE_FILL_COLOR,
  NOTE_PADDING,
  NOTE_SIZE,
  STROKE_COLOR,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
} from "../../constants"
import { createNote, getNextZIndex } from "../../elements"
import type { NoteElement, Point, TextAlign, ToolType } from "../../types"
import {
  calculateShapeBounds,
  createBaseToolState,
  getDefaultToolOptions,
  getToolOptionsForContext,
  type Tool,
  type ToolContext,
  type ToolOptions,
  type ToolState,
} from "../base"

const NOTE_DRAG_THRESHOLD = 6
const NOTE_MIN_DRAG_SIZE = 40

/**
 * Style and sizing options for the sticky-note tool. `fillColor` is the note
 * background and `strokeColor` is its text ink.
 */
export interface NoteToolOptions extends ToolOptions {
  /** Font size of the note text, in pixels. */
  fontSize?: number
  /** Font family stack. Defaults to the built-in system font stack. */
  fontFamily?: string
  /** Horizontal text alignment. Defaults to `"center"`. */
  textAlign?: TextAlign
  /** Unitless line height multiplier. Defaults to `1.25`. */
  lineHeight?: number
  /** Inner padding between the border and the text, in pixels. */
  padding?: number
  /** Corner radius of the note box, in pixels. */
  cornerRadius?: number
  /** Default width of a clicked note, in pixels. */
  width?: number
  /** Default height of a clicked note, in pixels. */
  height?: number
}

/**
 * Create the sticky-note tool. Clicking places a default-sized note and starts
 * editing it; dragging sizes the note instead.
 *
 * @param options Style and sizing defaults.
 * @returns The note tool.
 * @example
 * ```ts
 * const tool = createNoteTool({ fillColor: "#fde68a", fontSize: 22 })
 * ```
 */
export function createNoteTool(options: NoteToolOptions = {}): Tool {
  const state: ToolState = createBaseToolState()
  const toolOptions: NoteToolOptions = {
    ...getDefaultToolOptions(),
    cornerRadius: NOTE_CORNER_RADIUS,
    fillColor: NOTE_FILL_COLOR,
    fontFamily: TEXT_FONT_FAMILY,
    fontSize: TEXT_FONT_SIZE,
    height: NOTE_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    padding: NOTE_PADDING,
    textAlign: "center",
    width: NOTE_SIZE,
    ...options,
  }
  let temporaryElement: NoteElement | null = null
  let dragging = false

  const buildNote = (
    context: ToolContext,
    bounds: { height: number; width: number; x: number; y: number },
  ): NoteElement => {
    const current = getToolOptionsForContext(toolOptions, context)
    return createNote({
      cornerRadius: current.cornerRadius ?? NOTE_CORNER_RADIUS,
      fillColor: current.fillColor ?? NOTE_FILL_COLOR,
      fontFamily: current.fontFamily ?? TEXT_FONT_FAMILY,
      fontSize: current.fontSize ?? TEXT_FONT_SIZE,
      height: bounds.height,
      lineHeight: current.lineHeight ?? TEXT_LINE_HEIGHT,
      locked: false,
      opacity: current.opacity ?? 1,
      padding: current.padding ?? NOTE_PADDING,
      rotation: 0,
      strokeColor: current.strokeColor ?? STROKE_COLOR,
      text: "",
      textAlign: current.textAlign ?? "center",
      visible: true,
      width: bounds.width,
      x: bounds.x,
      y: bounds.y,
      zIndex: 0,
    })
  }

  const reset = () => {
    state.startPoint = null
    state.currentPoint = null
    temporaryElement = null
    dragging = false
  }

  return {
    cursor: "crosshair",
    getTemporaryElement() {
      return temporaryElement
    },
    onActivate() {
      state.isActive = true
    },
    onDeactivate() {
      state.isActive = false
      reset()
    },
    onPointerDown(_context: ToolContext, point: Point, _event: PointerEvent) {
      reset()
      state.startPoint = point
      state.currentPoint = point
    },
    onPointerMove(context: ToolContext, point: Point, event: PointerEvent) {
      if (!state.startPoint) {
        return
      }
      const dx = point.x - state.startPoint.x
      const dy = point.y - state.startPoint.y
      if (!dragging && Math.hypot(dx, dy) < NOTE_DRAG_THRESHOLD) {
        return
      }
      dragging = true
      const bounds = calculateShapeBounds(state.startPoint, point, {
        constrainProportions: event.shiftKey,
      })
      temporaryElement = buildNote(context, {
        height: Math.max(NOTE_MIN_DRAG_SIZE, bounds.height),
        width: Math.max(NOTE_MIN_DRAG_SIZE, bounds.width),
        x: bounds.x,
        y: bounds.y,
      })
      state.currentPoint = point
    },
    onPointerUp(context: ToolContext, _point: Point, event: PointerEvent) {
      if (!state.startPoint) {
        return
      }
      if (event.type === "pointercancel") {
        reset()
        return
      }

      // A click creates a default-sized note; a drag uses the bounds previewed
      // while the pointer moved. Either way the note is committed here, never
      // on pointer-down.
      let note = dragging ? temporaryElement : null
      if (!note) {
        const current = getToolOptionsForContext(toolOptions, context)
        const width = current.width ?? NOTE_SIZE
        const height = current.height ?? NOTE_SIZE
        note = buildNote(context, {
          height,
          width,
          x: state.startPoint.x - width / 2,
          y: state.startPoint.y - height / 2,
        })
      }

      const element: NoteElement = {
        ...note,
        zIndex: getNextZIndex(context.getElements().values()),
      }
      const elements = context.getElements()
      elements.set(element.id, element)
      context.setElements(elements)
      context.setSelectedIds(new Set([element.id]))
      context.pushHistory()
      reset()
      context.setActiveTool("select")
    },
    type: "note" as ToolType,
  }
}
