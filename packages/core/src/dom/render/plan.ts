import type { StateChangeKind } from "../../engine/state-notifier"

/**
 * One unit of DOM reconciliation selected by a state publication.
 *
 * @internal
 */
export type DomRenderAction =
  | "reconcileElements"
  | "renderSelectElements"
  | "renderGuides"
  | "renderTransformOverlay"
  | "renderAll"
  | "updateCursor"

/**
 * Turn the kinds changed by one canvas operation into a deduplicated render
 * plan in a fixed order.
 *
 * @internal
 */
export function planStateRender(
  kinds: ReadonlySet<StateChangeKind>,
): readonly DomRenderAction[] {
  const elements = kinds.has("elements")
  const selection = kinds.has("selection")
  const tool = kinds.has("tool")
  const full = kinds.has("viewport") || kinds.has("overlay")
  const plan: DomRenderAction[] = []

  if (elements) {
    plan.push("reconcileElements")
  }
  if (selection && !elements) {
    plan.push("renderSelectElements")
  }
  if (full) {
    plan.push("renderAll")
  } else {
    if (elements || tool) {
      plan.push("renderGuides")
    }
    if (elements || selection || tool) {
      plan.push("renderTransformOverlay")
    }
  }
  if (tool) {
    plan.push("updateCursor")
  }
  return plan
}
