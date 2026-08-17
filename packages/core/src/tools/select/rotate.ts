import type { Point } from "../../types"
import { type ToolContext } from "../base"
import { getPointsBounds, type SelectToolState } from "./state"

function rotatePoint(p: Point, center: Point, cos: number, sin: number): Point {
  const rx = p.x - center.x
  const ry = p.y - center.y
  return {
    x: center.x + rx * cos - ry * sin,
    y: center.y + rx * sin + ry * cos,
  }
}

// Rotate the selected elements around the selection center captured at
// pointer-down. Each element orbits its own center around `rotationCenter` by
// the angle swept since the drag started.
export function applyRotation(
  state: SelectToolState,
  context: ToolContext,
  point: Point,
): void {
  if (!state.rotationCenter || !state.startPoint) {
    return
  }

  const elements = context.getElements()
  const selectedIds = context.getSelectedIds()

  const startAngle = Math.atan2(
    state.startPoint.y - state.rotationCenter.y,
    state.startPoint.x - state.rotationCenter.x,
  )
  const currentAngle = Math.atan2(
    point.y - state.rotationCenter.y,
    point.x - state.rotationCenter.x,
  )
  const deltaAngle = (currentAngle - startAngle) * (180 / Math.PI)
  const deltaRad = (deltaAngle * Math.PI) / 180
  const cos = Math.cos(deltaRad)
  const sin = Math.sin(deltaRad)

  for (const id of selectedIds) {
    const original = state.originalPositions.get(id)
    if (original) {
      const element = elements.get(id)
      if (element) {
        // Orbit the element's center around the selection center
        const ecx = original.x + original.width / 2
        const ecy = original.y + original.height / 2
        const dx = ecx - state.rotationCenter.x
        const dy = ecy - state.rotationCenter.y
        const ndx = dx * cos - dy * sin
        const ndy = dx * sin + dy * cos
        const ncx = state.rotationCenter.x + ndx
        const ncy = state.rotationCenter.y + ndy

        const newRotation = (original.rotation + deltaAngle) % 360

        if (element.type === "path" && original.points) {
          // Translate path points by the orbital delta
          const tdx = ncx - ecx
          const tdy = ncy - ecy
          const newPoints = original.points.map((p) => ({
            x: p.x + tdx,
            y: p.y + tdy,
          }))
          const nb = getPointsBounds(newPoints)
          elements.set(id, {
            ...element,
            height: nb.height,
            points: newPoints,
            rotation: newRotation,
            width: nb.width,
            x: nb.x,
            y: nb.y,
          })
        } else if (
          element.type === "line" &&
          original.lineStart &&
          original.lineEnd
        ) {
          // Rotate the line's endpoints about the selection center. The line
          // keeps rotation=0; its visual rotation comes purely from the changed
          // endpoint coordinates.
          const rotatedStart = rotatePoint(
            original.lineStart,
            state.rotationCenter,
            cos,
            sin,
          )
          const rotatedEnd = rotatePoint(
            original.lineEnd,
            state.rotationCenter,
            cos,
            sin,
          )
          const minX = Math.min(rotatedStart.x, rotatedEnd.x)
          const minY = Math.min(rotatedStart.y, rotatedEnd.y)
          const maxX = Math.max(rotatedStart.x, rotatedEnd.x)
          const maxY = Math.max(rotatedStart.y, rotatedEnd.y)
          elements.set(id, {
            ...element,
            endX: rotatedEnd.x,
            endY: rotatedEnd.y,
            height: Math.max(1, maxY - minY),
            rotation: 0,
            startX: rotatedStart.x,
            startY: rotatedStart.y,
            width: Math.max(1, maxX - minX),
            x: minX,
            y: minY,
          })
        } else {
          elements.set(id, {
            ...element,
            rotation: newRotation,
            x: ncx - original.width / 2,
            y: ncy - original.height / 2,
          })
        }
      }
    }
  }
  context.setElements(new Map(elements))
}
