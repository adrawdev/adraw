import { pointInBounds } from "../../coordinates"
import { getElementAtPoint, getElementsBounds } from "../../elements"
import {
  createGroupIndex,
  getAffectedIds,
  getDirectChildId,
  getLeafDescendantIds,
  getTopLevelId,
  normalizeSelectionForLevel,
} from "../../groups"
import type { CanvasElement, Point, ToolType } from "../../types"
import { type Tool, type ToolContext } from "../base"
import { updateBrushSelection } from "./brush"
import { moveSelection } from "./move"
import { resizeSelection } from "./resize"
import { applyRotation } from "./rotate"
import { createSelectToolState, type SelectToolState } from "./state"

export interface SelectToolOptions {
  multiSelectModifier: "shift" | "ctrl"
}

export function createSelectTool(
  options: SelectToolOptions = { multiSelectModifier: "shift" },
): Tool {
  const state: SelectToolState = createSelectToolState()

  return {
    cursor: "default",
    getBindingCandidate() {
      return state.bindingCandidate
    },
    getSelectionBox() {
      return state.brushBox
    },
    getTemporaryElement() {
      return null
    },
    isResizing() {
      return state.dragHandle !== null && state.dragHandle !== "rotation"
    },
    isRotating() {
      return state.dragHandle === "rotation"
    },
    onActivate() {
      state.isActive = true
    },
    onDeactivate(context: ToolContext) {
      state.isActive = false
      state.startPoint = null
      state.currentPoint = null
      state.dragStartElement = null
      state.dragStartPoint = null
      state.dragHandle = null
      state.rotationCenter = null
      state.originalBounds = null
      state.bindingCandidate = null
      state.brushStart = null
      state.brushBox = null
      state.brushBaseSelection = null
      state.contextId = null
      state.isGroupSelection = false
      state.affectedIds.clear()
      state.transformIds.clear()
      state.originalPositions.clear()
      context.setGroupContext?.(null)
      context.setSelectedIds(new Set())
    },
    onPointerDown(context: ToolContext, point: Point, event: PointerEvent) {
      state.startPoint = point
      state.currentPoint = point

      const elements = context.getElements()
      const index = createGroupIndex(elements)
      const selectedIds = context.getSelectedIds()
      const contextId = context.getGroupContext?.() ?? null

      // Check if we clicked on a resize handle or rotation handle (only in
      // vanilla for now). For other frameworks, this would be handled by their
      // event systems.
      const target = event.target as HTMLElement
      state.dragHandle = target.getAttribute("data-anchor")

      if (!state.dragHandle) {
        const isMultiSelect =
          (options.multiSelectModifier === "shift" && event.shiftKey) ||
          (options.multiSelectModifier === "ctrl" && event.ctrlKey)

        const selectionBounds =
          selectedIds.size > 1 ? getElementsBounds(elements, selectedIds) : null
        const isInsideSelection =
          selectionBounds !== null && pointInBounds(point, selectionBounds)

        let hit = isInsideSelection ? null : getElementAtPoint(elements, point)
        // Clicking bound text selects the container it belongs to, so moving
        // the selection moves the container and its bound text instead of
        // detaching them.
        if (hit?.type === "text" && hit.containerId) {
          hit = elements.get(hit.containerId) ?? hit
        }

        let targetElement: CanvasElement | null = null
        let nextContextId = contextId
        let selectionBase = selectedIds

        if (isInsideSelection) {
          // The gap between selected elements is part of the selection box, so
          // it should start moving the selection instead of starting a marquee.
          for (const id of selectedIds) {
            const selectedElement = elements.get(id)
            if (selectedElement) {
              targetElement = selectedElement
              break
            }
          }
        } else if (hit) {
          if (contextId) {
            const levelTargetId = getDirectChildId(index, contextId, hit.id)
            if (levelTargetId) {
              // Inside a group, clicks act on its direct children.
              targetElement = elements.get(levelTargetId) ?? null
            } else {
              // Clicking outside the entered group leaves it and acts on the
              // outermost object at the top level.
              nextContextId = null
              selectionBase = normalizeSelectionForLevel(
                index,
                selectedIds,
                null,
              )
              const topId = getTopLevelId(index, hit.id)
              targetElement = elements.get(topId) ?? null
            }
          } else {
            targetElement = elements.get(getTopLevelId(index, hit.id)) ?? null
          }
        } else if (contextId) {
          const contextGroup = elements.get(contextId)
          const insideContext =
            contextGroup?.type === "group" &&
            point.x >= contextGroup.x &&
            point.x <= contextGroup.x + contextGroup.width &&
            point.y >= contextGroup.y &&
            point.y <= contextGroup.y + contextGroup.height
          if (!insideContext) {
            nextContextId = null
            selectionBase = normalizeSelectionForLevel(index, selectedIds, null)
          }
        }

        if (nextContextId !== contextId) {
          context.setGroupContext?.(nextContextId)
          if (isMultiSelect) {
            context.setSelectedIds(new Set(selectionBase))
          }
        }

        if (targetElement) {
          if (!isInsideSelection) {
            if (isMultiSelect) {
              const nextSelected = new Set(selectionBase)
              if (nextSelected.has(targetElement.id)) {
                nextSelected.delete(targetElement.id)
              } else {
                nextSelected.add(targetElement.id)
              }
              context.setSelectedIds(nextSelected)
            } else if (
              nextContextId !== contextId ||
              !selectionBase.has(targetElement.id)
            ) {
              context.setSelectedIds(new Set([targetElement.id]))
            }
          }

          state.dragStartElement = targetElement
          state.dragStartPoint = point
        } else {
          // Empty space: begin a marquee (rubber-band) selection. With the
          // multi-select modifier held, brushed elements are unioned onto the
          // existing selection; otherwise start from an empty selection.
          state.brushStart = point
          state.brushBox = { height: 0, width: 0, x: point.x, y: point.y }
          state.brushBaseSelection = isMultiSelect
            ? new Set(selectionBase)
            : new Set()
          if (!isMultiSelect) {
            context.setSelectedIds(new Set())
          }
        }
      }

      const selectedElements = context.getSelectedIds()
      state.contextId = context.getGroupContext?.() ?? null
      state.transformIds = getLeafDescendantIds(index, selectedElements)
      state.affectedIds = getAffectedIds(index, selectedElements)
      state.isGroupSelection = [...selectedElements].some(
        (id) => elements.get(id)?.type === "group",
      )

      for (const id of state.transformIds) {
        const el = elements.get(id)
        if (el) {
          state.originalPositions.set(id, {
            autoSize: el.type === "text" ? el.autoSize : undefined,
            fontFamily: el.type === "text" ? el.fontFamily : undefined,
            fontSize: el.type === "text" ? el.fontSize : undefined,
            height: el.height,
            lineEnd:
              el.type === "line" || el.type === "arrow"
                ? { x: el.endX, y: el.endY }
                : undefined,
            lineHeight: el.type === "text" ? el.lineHeight : undefined,
            lineStart:
              el.type === "line" || el.type === "arrow"
                ? { x: el.startX, y: el.startY }
                : undefined,
            // Paths are rendered from their absolute `points`, so a resize/move
            // must transform the points too. Snapshot them to transform against
            // a stable source instead of the already-mutated live element.
            points:
              el.type === "path"
                ? el.points.map((p) => ({ x: p.x, y: p.y }))
                : undefined,
            rotation: el.rotation,
            textAlign: el.type === "text" ? el.textAlign : undefined,
            width: el.width,
            x: el.x,
            y: el.y,
          })
        }
      }

      // Capture the bounding box of the selection at drag start. Both rotation
      // and resize must reference this constant snapshot, never the live
      // (already-mutated) elements, otherwise the transform feeds back on itself.
      if (selectedElements.size > 0) {
        const bounds = getElementsBounds(elements, selectedElements)
        if (bounds) {
          state.originalBounds = {
            height: bounds.height,
            width: bounds.width,
            x: bounds.x,
            y: bounds.y,
          }
          state.rotationCenter = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          }
        }
      }
    },
    onPointerMove(context: ToolContext, point: Point, event: PointerEvent) {
      if (!state.startPoint) {
        return
      }

      state.currentPoint = point
      const selectedIds = context.getSelectedIds()

      if (state.brushStart) {
        updateBrushSelection(state, context, point)
        return
      }

      if (state.dragHandle === "rotation" && state.rotationCenter) {
        applyRotation(state, context, point)
        return
      }

      if (
        state.dragHandle === "line-start" ||
        state.dragHandle === "line-end"
      ) {
        resizeSelection(
          state,
          context,
          point,
          selectedIds,
          event.shiftKey,
          event.altKey,
          event,
        )
        return
      }

      if (
        state.dragHandle &&
        state.dragHandle !== "rotation" &&
        state.originalBounds
      ) {
        resizeSelection(
          state,
          context,
          point,
          selectedIds,
          event.shiftKey,
          event.altKey,
          event,
        )
        return
      }

      if (state.dragStartElement && state.dragStartPoint) {
        moveSelection(state, context, point, event)
      }
    },
    onPointerUp(context: ToolContext, _point: Point, _event: PointerEvent) {
      // A marquee only changes selection, never geometry, so it must not push a
      // history entry even when it started from a non-empty selection.
      if (!state.brushStart && state.originalPositions.size > 0) {
        context.pushHistory()
      }

      state.startPoint = null
      state.currentPoint = null
      state.dragStartElement = null
      state.dragStartPoint = null
      state.dragHandle = null
      state.rotationCenter = null
      state.originalBounds = null
      state.bindingCandidate = null
      state.brushStart = null
      state.brushBox = null
      state.brushBaseSelection = null
      state.contextId = null
      state.isGroupSelection = false
      state.affectedIds.clear()
      state.transformIds.clear()
      state.originalPositions.clear()
    },
    type: "select" as ToolType,
  }
}
