import { STROKE_COLOR, TEXT_FONT_SIZE } from "../../constants"
import { createText, getNextZIndex, measureTextSize } from "../../elements"
import type { Point, TextElement, ToolType } from "../../types"
import {
  createBaseToolState,
  getDefaultToolOptions,
  type Tool,
  type ToolContext,
  type ToolOptions,
  type ToolState,
} from "../base"

export interface TextToolOptions extends ToolOptions {
  fontSize?: number
}

// Extension of the base tool interface: the DOM adapter drives the inline text
// editor by calling `setText` while a text element is being created.
export interface TextTool extends Tool {
  setText: (text: string) => void
}

export function createTextTool(options: TextToolOptions = {}): TextTool {
  const state: ToolState = createBaseToolState()
  const toolOptions = {
    ...getDefaultToolOptions(),
    fontSize: TEXT_FONT_SIZE,
    ...options,
  }
  let pendingText = ""
  let temporaryElement: TextElement | null = null

  const refreshTemporary = () => {
    if (!state.startPoint || !temporaryElement) {
      return
    }
    const size = measureTextSize(pendingText, toolOptions.fontSize)
    temporaryElement = {
      ...temporaryElement,
      height: size.height,
      text: pendingText,
      width: size.width,
    }
  }

  return {
    cursor: "text",
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
    },
    onPointerDown(context: ToolContext, point: Point, _event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point

      const size = measureTextSize(pendingText, toolOptions.fontSize)
      temporaryElement = createText({
        fontSize: toolOptions.fontSize,
        height: size.height,
        locked: false,
        rotation: 0,
        strokeColor:
          context.getStrokeColor() ?? toolOptions.strokeColor ?? STROKE_COLOR,
        text: pendingText,
        visible: true,
        width: size.width,
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

      if (pendingText.trim() !== "" && temporaryElement) {
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
    },
    setText(text: string) {
      pendingText = text
      refreshTemporary()
    },
    type: "text" as ToolType,
  }
}
