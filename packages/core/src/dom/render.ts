import {
  FILL_COLOR,
  NOTE_FILL_COLOR,
  STROKE_COLOR,
  STROKE_WIDTH,
} from "../constants"
import type { CanvasEngine } from "../engine/engine"
import { getNoteContentWidth, getNoteTextTop, measureNoteText } from "../note"
import { approximateTextMeasurer, type TextMeasurer } from "../text"
import type { BoundingBox, CanvasElement } from "../types"
import { renderGuides } from "./render/guides"
import { renderTransformOverlay } from "./render/overlay"
import { renderSelectionBox } from "./render/overlay-nodes"
import type { DomState } from "./state"
import {
  appendNoteTextLines,
  appendTextLines,
  applyArrowShaft,
  applyElementOpacity,
  applyNoteFold,
  applyNoteTextAttributes,
  applyTextAttributes,
  bindingTargetClass,
  createElementGroup,
  getArrowSvgGeometry,
  getTransformElementAttribute,
  pointsToPath,
  temporaryClass,
} from "./svg"

export function renderAll(state: DomState, engine: CanvasEngine): void {
  if (!state.container) {
    return
  }

  const viewport = engine.getViewport()
  const transform = `translate(${state.container.clientWidth / 2}, ${state.container.clientHeight / 2}) scale(${viewport.zoom}) translate(${-viewport.x}, ${-viewport.y})`

  for (const group of [
    state.elementsGroup,
    state.guidesGroup,
    state.transformOverlay,
  ]) {
    group?.setAttribute("transform", transform)
  }

  renderTemporary(state, engine)
  setTextElementVisibility(state, engine, !state.textEditor)
  renderBindingHighlight(state, engine)
  renderGuides(state, engine)
  renderTransformOverlay(state, engine)
  renderSelectionBox(state, engine)
  positionTextEditor(state, engine)
}

export function renderTemporary(state: DomState, engine: CanvasEngine): void {
  if (!state.elementsGroup) {
    return
  }

  const tempElement = engine.getTemporaryElement()

  // No in-progress element: drop the temporary node if one is lingering. It
  // may already have been adopted by `reconcileElements` as a committed
  // element's node (tools like text commit the same object/id their temporary
  // element used) — leave those alone.
  if (!tempElement) {
    if (
      state.temporaryNode &&
      !engine.getElements().has(state.temporaryNode.id)
    ) {
      state.temporaryNode.remove()
    } else if (state.temporaryNode) {
      state.temporaryNode.style.visibility = ""
    }
    state.temporaryNode = null
    state.temporaryType = null
    return
  }

  // The temporary element lives inside `elementsGroup` (on top, as the last
  // child). Reuse its node across pointer moves — while the type is unchanged,
  // update it in place rather than recreating it. Only build a fresh node when
  // there is none yet or the element type changed.
  if (!state.temporaryNode || state.temporaryType !== tempElement.type) {
    state.temporaryNode?.remove()
    const group = createElementGroup(tempElement, engine.getTextMeasurer())
    group.classList.add(temporaryClass)
    state.temporaryNode = group
    state.temporaryType = tempElement.type
    state.elementsGroup.appendChild(group)
    return
  }

  updateElementGeometry(
    state.temporaryNode,
    tempElement,
    engine.getTextMeasurer(),
  )
}

export function setTextElementVisibility(
  state: DomState,
  engine: CanvasEngine,
  visible: boolean,
): void {
  if (state.temporaryNode) {
    state.temporaryNode.style.visibility = visible ? "" : "hidden"
  }
  if (!state.textEditElementId || !state.elementsGroup) {
    return
  }

  const editing = engine.getElements().get(state.textEditElementId)
  for (const child of state.elementsGroup.children) {
    if (child.id === state.textEditElementId) {
      const group = child as SVGGElement
      if (editing?.type === "note") {
        // Keep the sticky background visible while its text is edited by the
        // overlay; only the painted glyphs are hidden.
        const text = group.querySelector("text")
        if (text) {
          text.style.visibility = visible ? "" : "hidden"
        }
      } else {
        group.style.visibility = visible ? "" : "hidden"
      }
      break
    }
  }
}

// Mirror the active tool's binding candidate onto the candidate's element node
// as a CSS class hook (`.adraw-binding-target`). Toggles only on change so
// unchanged nodes aren't touched on every pointer move.
export function renderBindingHighlight(
  state: DomState,
  engine: CanvasEngine,
): void {
  const candidate = engine.getBindingCandidate()
  if (state.bindingHighlightId === candidate) {
    return
  }
  if (state.bindingHighlightId) {
    state.nodeById
      .get(state.bindingHighlightId)
      ?.classList.remove(bindingTargetClass)
  }
  state.bindingHighlightId = candidate
  if (candidate) {
    state.nodeById.get(candidate)?.classList.add(bindingTargetClass)
  }
}

// Update an existing element's DOM node (transform + type-specific geometry)
// in place, without recreating it.
export function updateElementGeometry(
  group: SVGGElement,
  element: CanvasElement,
  textMeasurer: TextMeasurer = approximateTextMeasurer,
  arrowLabelBox: BoundingBox | null = null,
): void {
  group.setAttribute("transform", getTransformElementAttribute(element))
  applyElementOpacity(group, element)

  switch (element.type) {
    case "line": {
      const lineElement = group.getElementsByTagName("line")[0]
      lineElement.setAttribute("x1", `${element.startX}`)
      lineElement.setAttribute("y1", `${element.startY}`)
      lineElement.setAttribute("x2", `${element.endX}`)
      lineElement.setAttribute("y2", `${element.endY}`)
      lineElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      lineElement.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      break
    }
    case "arrow": {
      const geometry = getArrowSvgGeometry(element, arrowLabelBox)
      const stroke = element.strokeColor || STROKE_COLOR
      const strokeWidth = element.strokeWidth || STROKE_WIDTH
      const shafts = group.getElementsByTagName("line")
      const lineElement = shafts[0]
      applyArrowShaft(
        lineElement,
        geometry.lineStart,
        geometry.gapStart ?? geometry.lineEnd,
        stroke,
        strokeWidth,
      )
      const tail = shafts[1]
      if (tail) {
        applyArrowShaft(
          tail,
          geometry.gapEnd ?? geometry.lineEnd,
          geometry.lineEnd,
          stroke,
          strokeWidth,
        )
      }

      const heads = group.getElementsByTagName("path")
      const data = [geometry.endHead, geometry.startHead]
      for (let i = 0; i < data.length; i++) {
        const d = data[i]
        if (d) {
          heads[i].setAttribute("d", d)
          heads[i].removeAttribute("display")
        } else {
          heads[i].setAttribute("display", "none")
        }
        heads[i].setAttribute("fill", stroke)
      }
      break
    }
    case "path": {
      const pathElement = group.getElementsByTagName("path")[0]
      pathElement.setAttribute(
        "d",
        pointsToPath(element.points, element.smoothing),
      )
      pathElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      pathElement.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      break
    }
    case "rectangle": {
      const rectElement = group.getElementsByTagName("rect")[0]
      rectElement.setAttribute("width", `${element.width}`)
      rectElement.setAttribute("height", `${element.height}`)
      rectElement.setAttribute("rx", `${element.cornerRadius}`)
      rectElement.setAttribute("ry", `${element.cornerRadius}`)
      rectElement.setAttribute("fill", element.fillColor || FILL_COLOR)
      rectElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      rectElement.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      break
    }
    case "ellipse": {
      const ellipseElement = group.getElementsByTagName("ellipse")[0]
      ellipseElement.setAttribute("cx", `${element.width / 2}`)
      ellipseElement.setAttribute("cy", `${element.height / 2}`)
      ellipseElement.setAttribute("rx", `${element.width / 2}`)
      ellipseElement.setAttribute("ry", `${element.height / 2}`)
      ellipseElement.setAttribute("fill", element.fillColor || FILL_COLOR)
      ellipseElement.setAttribute("stroke", element.strokeColor || STROKE_COLOR)
      ellipseElement.setAttribute(
        "stroke-width",
        `${element.strokeWidth || STROKE_WIDTH}`,
      )
      break
    }
    case "media": {
      const imageElement = group.getElementsByTagName("image")[0]
      imageElement.setAttribute("width", `${element.width}`)
      imageElement.setAttribute("height", `${element.height}`)
      break
    }
    case "text": {
      const textElement = group.getElementsByTagName("text")[0]
      applyTextAttributes(textElement, element)
      textElement.textContent = ""
      appendTextLines(textElement, element, textMeasurer)
      break
    }
    case "note": {
      const rectElement = group.getElementsByTagName("rect")[0]
      rectElement.setAttribute("width", `${element.width}`)
      rectElement.setAttribute("height", `${element.height}`)
      rectElement.setAttribute("rx", `${element.cornerRadius}`)
      rectElement.setAttribute("ry", `${element.cornerRadius}`)
      rectElement.setAttribute("fill", element.fillColor || NOTE_FILL_COLOR)

      const foldElement = group.getElementsByTagName("path")[0]
      if (foldElement) {
        applyNoteFold(foldElement, element)
      }

      const textElement = group.getElementsByTagName("text")[0]
      applyNoteTextAttributes(textElement, element)
      textElement.textContent = ""
      appendNoteTextLines(textElement, element, textMeasurer)
      break
    }
  }
}

// Keep the document-positioned editor anchored to its canvas-space element
// across zoom/pan/typing. The textarea uses the element's unscaled font and
// box; `transform` applies the viewport zoom and the element's rotation about
// its center, exactly like the SVG group it replaces while editing.
export function positionTextEditor(
  state: DomState,
  engine: CanvasEngine,
): void {
  const editor = state.textEditor
  if (!editor) {
    return
  }

  const container = state.container
  const canvasRect = state.svgElement?.getBoundingClientRect()
  if (!canvasRect || !container) {
    return
  }

  const editing = state.textEditElementId
    ? engine.getElements().get(state.textEditElementId)
    : engine.getTemporaryElement()
  const element = editing?.type === "text" ? editing : null
  const note = editing?.type === "note" ? editing : null
  const options = engine.getToolOptions("text")
  const noteOptions = engine.getToolOptions("note")

  const fontOptions = note ? noteOptions : options
  const fontSize = note?.fontSize ?? element?.fontSize ?? fontOptions.fontSize
  const fontFamily =
    note?.fontFamily ?? element?.fontFamily ?? fontOptions.fontFamily
  const lineHeight =
    note?.lineHeight ?? element?.lineHeight ?? fontOptions.lineHeight
  const autoSize = note ? false : (element?.autoSize ?? options.autoSize)
  const textAlign = note
    ? (note.textAlign ?? noteOptions.textAlign)
    : (element?.textAlign ?? options.textAlign)
  const rotation = editing?.rotation ?? 0

  let x = element?.x ?? state.textEditPoint?.x ?? 0
  let y = element?.y ?? state.textEditPoint?.y ?? 0
  let width = Math.max(element?.width ?? 1, fontSize * 0.3)
  let height = Math.max(fontSize * lineHeight, element?.height ?? 0)

  if (note) {
    const layout = measureNoteText(note, engine.getTextMeasurer())
    x = note.x + note.padding
    y = note.y + getNoteTextTop(note, layout)
    width = getNoteContentWidth(note)
    height = Math.max(layout.height, fontSize * lineHeight)
  }

  const viewport = engine.getViewport()
  const canvasSize = engine.getCanvasSize()
  const canvasWidth = canvasRect.width || canvasSize.width
  const canvasHeight = canvasRect.height || canvasSize.height
  const scrollX = container.ownerDocument.defaultView?.scrollX ?? 0
  const scrollY = container.ownerDocument.defaultView?.scrollY ?? 0

  // Rotate around the element's center, not the editor box's center: a note's
  // editor only covers the padded content area, which is not centered in the
  // sticky when its text is short or overflowing.
  const originCanvasX = note ? note.x + note.width / 2 : x + width / 2
  const originCanvasY = note ? note.y + note.height / 2 : y + height / 2
  const pivotX = note ? note.width / 2 - (x - note.x) : width / 2
  const pivotY = note ? note.height / 2 - (y - note.y) : height / 2
  const screenOriginX =
    canvasRect.left +
    scrollX +
    (originCanvasX - viewport.x) * viewport.zoom +
    canvasWidth / 2
  const screenOriginY =
    canvasRect.top +
    scrollY +
    (originCanvasY - viewport.y) * viewport.zoom +
    canvasHeight / 2

  const style = editor.style
  style.fontFamily = fontFamily
  style.fontSize = `${fontSize}px`
  style.lineHeight = `${fontSize * lineHeight}px`
  style.textAlign = textAlign
  style.opacity = `${editing?.opacity ?? 1}`
  style.whiteSpace = autoSize ? "pre" : "pre-wrap"
  style.wordBreak = autoSize ? "normal" : "break-word"
  style.overflowWrap = autoSize ? "normal" : "break-word"
  editor.wrap = autoSize ? "off" : "soft"
  style.left = `${screenOriginX - pivotX}px`
  style.top = `${screenOriginY - pivotY}px`
  style.width = `${width}px`
  style.height = `${height}px`
  style.transformOrigin = note ? `${pivotX}px ${pivotY}px` : "center center"
  style.transform = `scale(${viewport.zoom}) rotate(${rotation}deg)`
}
