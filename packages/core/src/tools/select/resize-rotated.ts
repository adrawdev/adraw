import type { ElementId, Point } from "../../types"
import { type ToolContext } from "../base"
import {
  constrainResizeDimensions,
  getPointsBounds,
  getResizeAxes,
  type SelectToolState,
} from "./state"

// Resize a single element whose rotation is a non-zero multiple of 90°. The
// handles live in the element's rotated frame, so the resize must be computed
// there: un-rotate the pointer into the element's local space, size against the
// fixed (opposite) corner, and then re-derive the center so that corner stays
// put in world space.
export function resizeRotatedElement(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
  singleId: ElementId,
  constrainProportions = false,
  fromCenter = false,
): void {
  const bounds = state.originalBounds
  const singleOriginal = state.originalPositions.get(singleId)
  if (!bounds || !singleOriginal) {
    return
  }
  const { changesHeight, changesWidth, movesLeft, movesTop } = getResizeAxes(
    state.dragHandle ?? "",
  )

  const elements = context.getElements()
  const element = elements.get(singleId)
  if (!element) {
    return
  }

  const theta = (singleOriginal.rotation * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const cx = singleOriginal.x + singleOriginal.width / 2
  const cy = singleOriginal.y + singleOriginal.height / 2

  // Pointer in the element's local (unrotated) frame: R(-theta).
  const px = point.x - cx
  const py = point.y - cy
  const localX = cx + px * cos + py * sin
  const localY = cy - px * sin + py * cos

  // Alt keeps the element center fixed; otherwise the opposite edge stays
  // fixed in local space.
  let anchorX = fromCenter
    ? bounds.x + bounds.width / 2
    : movesLeft
      ? bounds.x + bounds.width
      : bounds.x
  let anchorY = fromCenter
    ? bounds.y + bounds.height / 2
    : movesTop
      ? bounds.y + bounds.height
      : bounds.y

  // Left signed so a handle dragged past the opposite edge yields a negative
  // size, which flips the element across the anchor.
  let newWidth = changesWidth
    ? fromCenter
      ? 2 * (movesLeft ? anchorX - localX : localX - anchorX)
      : movesLeft
        ? anchorX - localX
        : localX - anchorX
    : bounds.width
  let newHeight = changesHeight
    ? fromCenter
      ? 2 * (movesTop ? anchorY - localY : localY - anchorY)
      : movesTop
        ? anchorY - localY
        : localY - anchorY
    : bounds.height

  if (constrainProportions) {
    const constrained = constrainResizeDimensions(
      newWidth,
      newHeight,
      bounds.width,
      bounds.height,
      changesWidth,
      changesHeight,
    )
    newWidth = constrained.width
    newHeight = constrained.height

    if (!changesWidth) {
      anchorX = bounds.x + bounds.width / 2
    }
    if (!changesHeight) {
      anchorY = bounds.y + bounds.height / 2
    }
  }

  if (element.type === "path" && singleOriginal.points) {
    // Scale the points about the fixed edge in the element's local (unrotated)
    // frame, then translate so the dragged-opposite corner stays put in world
    // space. The rotation pivot is the bbox center, which shifts as the box
    // resizes; t = (I - R(theta)) * (Cold - Cnew) cancels the world-space drift
    // that shift introduces.
    const scaleX = newWidth / bounds.width
    const scaleY = newHeight / bounds.height
    const scaled = singleOriginal.points.map((p) => ({
      x: anchorX + (p.x - anchorX) * scaleX,
      y: anchorY + (p.y - anchorY) * scaleY,
    }))
    const nb = getPointsBounds(scaled)

    const ddx = cx - (nb.x + nb.width / 2)
    const ddy = cy - (nb.y + nb.height / 2)
    const tx = ddx - (ddx * cos - ddy * sin)
    const ty = ddy - (ddx * sin + ddy * cos)

    elements.set(singleId, {
      ...element,
      height: nb.height,
      points: scaled.map((p) => ({ x: p.x + tx, y: p.y + ty })),
      width: nb.width,
      x: nb.x + tx,
      y: nb.y + ty,
    })
    context.setElements(new Map(elements))
    return
  }

  if (
    element.type === "line" &&
    singleOriginal.lineStart &&
    singleOriginal.lineEnd
  ) {
    const scaleX = newWidth / bounds.width
    const scaleY = newHeight / bounds.height
    const scaledStart = {
      x: anchorX + (singleOriginal.lineStart.x - anchorX) * scaleX,
      y: anchorY + (singleOriginal.lineStart.y - anchorY) * scaleY,
    }
    const scaledEnd = {
      x: anchorX + (singleOriginal.lineEnd.x - anchorX) * scaleX,
      y: anchorY + (singleOriginal.lineEnd.y - anchorY) * scaleY,
    }
    const minX = Math.min(scaledStart.x, scaledEnd.x)
    const minY = Math.min(scaledStart.y, scaledEnd.y)
    const maxX = Math.max(scaledStart.x, scaledEnd.x)
    const maxY = Math.max(scaledStart.y, scaledEnd.y)
    const nb = {
      height: Math.max(1, maxY - minY),
      width: Math.max(1, maxX - minX),
      x: minX,
      y: minY,
    }

    const ddx = cx - (nb.x + nb.width / 2)
    const ddy = cy - (nb.y + nb.height / 2)
    const tx = ddx - (ddx * cos - ddy * sin)
    const ty = ddy - (ddx * sin + ddy * cos)

    elements.set(singleId, {
      ...element,
      endX: scaledEnd.x + tx,
      endY: scaledEnd.y + ty,
      height: nb.height,
      startX: scaledStart.x + tx,
      startY: scaledStart.y + ty,
      width: nb.width,
      x: nb.x + tx,
      y: nb.y + ty,
    })
    context.setElements(new Map(elements))
    return
  }

  // Anchor offset from center, before and after the resize. The anchor is the
  // corner/edge opposite the dragged handle.
  const signX = changesWidth ? (movesLeft ? 1 : -1) : 0
  const signY = changesHeight ? (movesTop ? 1 : -1) : 0
  const origDx = (signX * bounds.width) / 2
  const origDy = (signY * bounds.height) / 2
  const newDx = (signX * newWidth) / 2
  const newDy = (signY * newHeight) / 2

  // World position of the anchor stays fixed: world = C + R(theta)*d.
  // newDx/newDy carry the (possibly negative) sign so the center lands on the
  // correct side when the box flips past the anchor. Alt keeps the center in
  // place instead.
  const anchorWorldX = cx + origDx * cos - origDy * sin
  const anchorWorldY = cy + origDx * sin + origDy * cos
  const newCx = fromCenter ? cx : anchorWorldX - (newDx * cos - newDy * sin)
  const newCy = fromCenter ? cy : anchorWorldY - (newDx * sin + newDy * cos)

  // Store positive dimensions about the same center; a rectangle mirrored about
  // its own center is identical, so abs() is all the flip needs here.
  const absWidth = Math.max(1, Math.abs(newWidth))
  const absHeight = Math.max(1, Math.abs(newHeight))
  elements.set(singleId, {
    ...element,
    height: absHeight,
    width: absWidth,
    x: newCx - absWidth / 2,
    y: newCy - absHeight / 2,
  })
  context.setElements(new Map(elements))
}
