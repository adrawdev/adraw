import type { ElementId, Point } from "../../types"
import { type ToolContext } from "../base"
import { resizeRotatedElement } from "./resize-rotated"
import { getPointsBounds, getResizeAxes, type SelectToolState } from "./state"

// Drag a line's endpoint handle — move that endpoint and update bbox.
function resizeLineEndpoint(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
  dragHandle: string,
): void {
  const elements = context.getElements()
  const selectedIds = context.getSelectedIds()

  for (const id of selectedIds) {
    const element = elements.get(id)
    const original = state.originalPositions.get(id)
    if (
      element?.type !== "line" ||
      !original ||
      !original.lineStart ||
      !original.lineEnd
    ) {
      continue
    }
    if (dragHandle === "line-start") {
      const newX = Math.min(point.x, original.lineEnd.x)
      const newY = Math.min(point.y, original.lineEnd.y)
      const newW = Math.abs(point.x - original.lineEnd.x)
      const newH = Math.abs(point.y - original.lineEnd.y)
      elements.set(id, {
        ...element,
        endX: original.lineEnd.x,
        endY: original.lineEnd.y,
        height: Math.max(1, newH),
        startX: point.x,
        startY: point.y,
        width: Math.max(1, newW),
        x: newX,
        y: newY,
      })
    } else {
      const newX = Math.min(original.lineStart.x, point.x)
      const newY = Math.min(original.lineStart.y, point.y)
      const newW = Math.abs(point.x - original.lineStart.x)
      const newH = Math.abs(point.y - original.lineStart.y)
      elements.set(id, {
        ...element,
        endX: point.x,
        endY: point.y,
        height: Math.max(1, newH),
        startX: original.lineStart.x,
        startY: original.lineStart.y,
        width: Math.max(1, newW),
        x: newX,
        y: newY,
      })
    }
  }
  context.setElements(new Map(elements))
}

// Resize selected elements relative to the snapshot taken on pointer-down so
// the transform tracks the pointer instead of feeding back on the elements it
// just mutated. A single selected element with non-axis-aligned rotation is
// delegated to `resizeRotatedElement`, which computes in its local frame.
export function resizeSelection(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
  selectedIds: Set<ElementId>,
): void {
  const bounds = state.originalBounds
  const dragHandle = state.dragHandle
  if (!bounds || !dragHandle || dragHandle === "rotation") {
    return
  }

  if (dragHandle === "line-start" || dragHandle === "line-end") {
    resizeLineEndpoint(state, context, point, dragHandle)
    return
  }

  const { changesHeight, changesWidth, movesLeft, movesTop } =
    getResizeAxes(dragHandle)

  const [singleId] = selectedIds
  const singleOriginal =
    selectedIds.size === 1 ? state.originalPositions.get(singleId) : undefined

  if (singleOriginal && singleOriginal.rotation % 360 !== 0) {
    resizeRotatedElement(state, context, point, singleId)
    return
  }

  const elements = context.getElements()

  // The corner/edge opposite the dragged handle stays fixed.
  const anchorX = movesLeft ? bounds.x + bounds.width : bounds.x
  const anchorY = movesTop ? bounds.y + bounds.height : bounds.y

  const newWidth = changesWidth
    ? movesLeft
      ? anchorX - point.x
      : point.x - anchorX
    : bounds.width
  const newHeight = changesHeight
    ? movesTop
      ? anchorY - point.y
      : point.y - anchorY
    : bounds.height

  const scaleX = changesWidth ? newWidth / bounds.width : 1
  const scaleY = changesHeight ? newHeight / bounds.height : 1

  for (const id of selectedIds) {
    const original = state.originalPositions.get(id)
    if (original) {
      const element = elements.get(id)
      if (element) {
        if (element.type === "path" && original.points) {
          // A path renders from its absolute points, so scale those about the
          // same anchor instead of only resizing the bounding box. A negative
          // scale (handle dragged past the anchor) mirrors the points;
          // re-derive the bbox from the result so it stays valid.
          const scaledPoints = original.points.map((p) => ({
            x: anchorX + (p.x - anchorX) * scaleX,
            y: anchorY + (p.y - anchorY) * scaleY,
          }))
          const nb = getPointsBounds(scaledPoints)
          elements.set(id, {
            ...element,
            height: Math.max(1, nb.height),
            points: scaledPoints,
            width: Math.max(1, nb.width),
            x: nb.x,
            y: nb.y,
          })
        } else if (
          element.type === "line" &&
          original.lineStart &&
          original.lineEnd
        ) {
          // Scale the line's absolute endpoints about the same anchor.
          const scaledStart = {
            x: anchorX + (original.lineStart.x - anchorX) * scaleX,
            y: anchorY + (original.lineStart.y - anchorY) * scaleY,
          }
          const scaledEnd = {
            x: anchorX + (original.lineEnd.x - anchorX) * scaleX,
            y: anchorY + (original.lineEnd.y - anchorY) * scaleY,
          }
          const minX = Math.min(scaledStart.x, scaledEnd.x)
          const minY = Math.min(scaledStart.y, scaledEnd.y)
          const maxX = Math.max(scaledStart.x, scaledEnd.x)
          const maxY = Math.max(scaledStart.y, scaledEnd.y)
          elements.set(id, {
            ...element,
            endX: scaledEnd.x,
            endY: scaledEnd.y,
            height: Math.max(1, maxY - minY),
            startX: scaledStart.x,
            startY: scaledStart.y,
            width: Math.max(1, maxX - minX),
            x: minX,
            y: minY,
          })
        } else {
          // Scale each element's size and position relative to the fixed anchor
          // so multi-element selections keep their layout.
          let newX = anchorX + (original.x - anchorX) * scaleX
          let newY = anchorY + (original.y - anchorY) * scaleY
          let newElementWidth = original.width * scaleX
          let newElementHeight = original.height * scaleY

          // A handle dragged past the opposite edge produces a negative scale;
          // flip the element across the anchor instead of pinning it to a 1px
          // sliver.
          if (newElementWidth < 0) {
            newX += newElementWidth
            newElementWidth = -newElementWidth
          }
          if (newElementHeight < 0) {
            newY += newElementHeight
            newElementHeight = -newElementHeight
          }

          elements.set(id, {
            ...element,
            height: Math.max(1, newElementHeight),
            width: Math.max(1, newElementWidth),
            x: newX,
            y: newY,
          })
        }
      }
    }
  }
  context.setElements(new Map(elements))
}
