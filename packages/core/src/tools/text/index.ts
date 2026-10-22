import {
  STROKE_COLOR,
  TEXT_FONT_FAMILY,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
} from "../../constants"
import { createText, getNextZIndex } from "../../elements"
import { approximateTextMeasurer, type TextMeasurer } from "../../text"
import type {
  BoundingBox,
  CanvasElementStyle,
  Point,
  TextAlign,
  TextElement,
  ToolType,
} from "../../types"
import {
  createBaseToolState,
  getDefaultToolOptions,
  getStyleForContext,
  type Tool,
  type ToolContext,
  type ToolState,
} from "../base"

export interface TextToolOptions extends CanvasElementStyle {
  fontSize?: number
  /** Font family stack. Defaults to the built-in system font stack. */
  fontFamily?: string
  /** Horizontal line alignment. Defaults to `"left"`. */
  textAlign?: TextAlign
  /** Unitless line height multiplier. Defaults to `1.25`. */
  lineHeight?: number
  /**
   * When `true` (default) new text grows horizontally to fit its content.
   * When `false` it wraps at its width.
   */
  autoSize?: boolean
}

// Extension of the base tool interface: the DOM adapter drives the inline text
// editor by calling `setText` while a text element is being created.
export interface TextTool extends Tool {
  setText: (text: string) => void
  /** Turn the pending gesture into a fixed-width box (drag-to-create). */
  setFixedWidth: (width: number, x?: number) => void
}

export function createTextTool(options: TextToolOptions = {}): TextTool {
  const state: ToolState = createBaseToolState()
  const defaults = {
    ...getDefaultToolOptions(),
    autoSize: true,
    fontFamily: TEXT_FONT_FAMILY,
    fontSize: TEXT_FONT_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    textAlign: "left" as TextAlign,
    ...options,
  }
  let pendingText = ""
  let temporaryElement: TextElement | null = null
  let gestureOptions = defaults
  let gestureMeasurer: TextMeasurer = approximateTextMeasurer
  // A fixed-width drag commits an empty element so the editor can open on it.
  let commitEmpty = false
  let dragBox: BoundingBox | null = null

  const refreshTemporary = () => {
    if (!state.startPoint || !temporaryElement) {
      return
    }
    const layout = gestureMeasurer(pendingText, {
      autoSize: gestureOptions.autoSize ?? true,
      fontFamily: gestureOptions.fontFamily ?? TEXT_FONT_FAMILY,
      fontSize: gestureOptions.fontSize ?? TEXT_FONT_SIZE,
      lineHeight: gestureOptions.lineHeight ?? TEXT_LINE_HEIGHT,
      maxWidth: temporaryElement.width,
    })
    temporaryElement = {
      ...temporaryElement,
      height: layout.height,
      text: pendingText,
      width: layout.width,
    }
  }

  return {
    cursor: "text",
    getSelectionBox() {
      return dragBox
    },
    getTemporaryElement() {
      return temporaryElement
    },
    onActivate() {
      state.isActive = true
    },
    onDeactivate() {
      state.isActive = false
      state.startPoint = null
      state.currentPoint = null
      temporaryElement = null
      pendingText = ""
      commitEmpty = false
      dragBox = null
    },
    onPointerDown(context: ToolContext, point: Point, _event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point
      gestureOptions = getStyleForContext(defaults, context)
      gestureMeasurer = context.measureText ?? approximateTextMeasurer

      const fontSize = gestureOptions.fontSize ?? TEXT_FONT_SIZE
      const layout = gestureMeasurer(pendingText, {
        autoSize: gestureOptions.autoSize ?? true,
        fontFamily: gestureOptions.fontFamily ?? TEXT_FONT_FAMILY,
        fontSize,
        lineHeight: gestureOptions.lineHeight ?? TEXT_LINE_HEIGHT,
      })
      temporaryElement = createText({
        autoSize: gestureOptions.autoSize ?? true,
        fontFamily: gestureOptions.fontFamily ?? TEXT_FONT_FAMILY,
        fontSize,
        height: layout.height,
        lineHeight: gestureOptions.lineHeight ?? TEXT_LINE_HEIGHT,
        locked: false,
        opacity: gestureOptions.opacity ?? 1,
        rotation: 0,
        strokeColor: gestureOptions.strokeColor ?? STROKE_COLOR,
        text: pendingText,
        textAlign: gestureOptions.textAlign ?? "left",
        visible: true,
        width: layout.width,
        x: point.x,
        y: point.y,
        zIndex: 0,
      })
    },
    onPointerMove(
      _context: ToolContext,
      _point: Point,
      _event: PointerEvent,
    ) {},
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      if ((pendingText.trim() !== "" || commitEmpty) && temporaryElement) {
        const element = temporaryElement
        const elements = context.getElements()
        elements.set(element.id, {
          ...element,
          zIndex: getNextZIndex(elements.values()),
        })
        context.setElements(elements)
        context.setSelectedIds(new Set([element.id]))
        context.pushHistory()
        context.setActiveTool("select")
      }

      state.startPoint = null
      state.currentPoint = null
      temporaryElement = null
      pendingText = ""
      commitEmpty = false
      dragBox = null
    },
    /**
     * Turn the pending gesture into a fixed-width text box. Called by the DOM
     * adapter while the user drags the text tool horizontally.
     *
     * @param width Box width in canvas units.
     * @param x Optional left edge (defaults to the press point).
     */
    setFixedWidth(width: number, x?: number) {
      if (!temporaryElement) {
        return
      }
      const fontSize = gestureOptions.fontSize ?? TEXT_FONT_SIZE
      const layout = gestureMeasurer(pendingText, {
        autoSize: false,
        fontFamily: gestureOptions.fontFamily ?? TEXT_FONT_FAMILY,
        fontSize,
        lineHeight: gestureOptions.lineHeight ?? TEXT_LINE_HEIGHT,
        maxWidth: Math.max(1, width),
      })
      temporaryElement = {
        ...temporaryElement,
        autoSize: false,
        height: layout.height,
        text: pendingText,
        width: layout.width,
        x: x ?? temporaryElement.x,
      }
      dragBox = {
        height: layout.height,
        width: layout.width,
        x: temporaryElement.x,
        y: temporaryElement.y,
      }
      commitEmpty = true
    },
    setText(text: string) {
      pendingText = text
      refreshTemporary()
    },
    type: "text" as ToolType,
  }
}
