import { generateId } from "../coordinates"
import type { ClipboardOptions } from "../options"
import type { CanvasElement, ElementId, Point } from "../types"

const CLIPBOARD_TYPE = "adraw/clipboard"
const CLIPBOARD_VERSION = 1

interface ClipboardEnvelope {
  elements: CanvasElement[]
  type: typeof CLIPBOARD_TYPE
  version: number
}

// Deep-copy an element: path points and group child lists are the only nested
// structures, so clipboard contents never alias live canvas state.
export function cloneElementDeep(element: CanvasElement): CanvasElement {
  if (element.type === "path") {
    return {
      ...element,
      points: element.points.map((point) => ({ x: point.x, y: point.y })),
    }
  }
  if (element.type === "group") {
    return { ...element, children: [...element.children] }
  }
  return { ...element }
}

// Snapshot the selected elements, recursively including the children of any
// selected group so a pasted group never references missing elements.
export function collectClipboardElements(
  elements: Map<ElementId, CanvasElement>,
  selectedIds: Set<ElementId>,
): CanvasElement[] {
  const collected = new Map<ElementId, CanvasElement>()

  const visit = (id: ElementId): void => {
    if (collected.has(id)) {
      return
    }
    const element = elements.get(id)
    if (!element) {
      return
    }
    collected.set(id, cloneElementDeep(element))
    if (element.type === "group") {
      for (const childId of element.children) {
        visit(childId)
      }
    }
  }

  for (const id of selectedIds) {
    visit(id)
  }

  return [...collected.values()]
}

// Clone clipboard elements with fresh IDs, translated so their bounding box is
// centered on `at`, stacked above `baseZIndex`. Group children are remapped to
// the pasted clones.
export function createPastedElements(
  elements: CanvasElement[],
  at: Point,
  baseZIndex: number,
): CanvasElement[] {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const element of elements) {
    left = Math.min(left, element.x)
    right = Math.max(right, element.x + element.width)
    top = Math.min(top, element.y)
    bottom = Math.max(bottom, element.y + element.height)
  }

  const dx = at.x - (left + right) / 2
  const dy = at.y - (top + bottom) / 2

  const idMap = new Map<ElementId, ElementId>()
  for (const element of elements) {
    idMap.set(element.id, generateId())
  }

  return elements
    .toSorted((a, b) => a.zIndex - b.zIndex)
    .map((element, index) => {
      const clone = cloneElementDeep(element)
      clone.id = idMap.get(element.id)!
      clone.x += dx
      clone.y += dy
      clone.zIndex = baseZIndex + index

      if (clone.type === "line") {
        clone.startX += dx
        clone.startY += dy
        clone.endX += dx
        clone.endY += dy
      } else if (clone.type === "path") {
        clone.points = clone.points.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        }))
      } else if (clone.type === "group") {
        clone.children = clone.children.map(
          (childId) => idMap.get(childId) ?? childId,
        )
      }

      return clone
    })
}

function isCanvasElement(value: unknown): value is CanvasElement {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const element = value as Partial<CanvasElement>
  return (
    typeof element.id === "string" &&
    typeof element.type === "string" &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number"
  )
}

function parseDefault(data: string): CanvasElement[] | null {
  try {
    const parsed: unknown = JSON.parse(data)
    if (Array.isArray(parsed)) {
      return parsed.every(isCanvasElement) ? parsed : null
    }
    if (typeof parsed === "object" && parsed !== null) {
      const envelope = parsed as Partial<ClipboardEnvelope>
      if (
        envelope.type === CLIPBOARD_TYPE &&
        Array.isArray(envelope.elements)
      ) {
        return envelope.elements.every(isCanvasElement)
          ? envelope.elements
          : null
      }
    }
    return null
  } catch {
    return null
  }
}

// In-memory clipboard owned by one engine. The optional serialize/deserialize
// hooks let consumers bridge the buffer to the system clipboard (or any other
// transport) without the engine touching async platform APIs.
export class ClipboardManager {
  private elements: CanvasElement[] = []
  private readonly deserializeFn:
    | ((data: string) => CanvasElement[] | null)
    | null
  private readonly serializeFn: ((elements: CanvasElement[]) => string) | null

  constructor(options: ClipboardOptions = {}) {
    this.serializeFn = options.serialize ?? null
    this.deserializeFn = options.deserialize ?? null
  }

  hasContent(): boolean {
    return this.elements.length > 0
  }

  clear(): void {
    this.elements = []
  }

  write(elements: CanvasElement[]): void {
    this.elements = elements.map(cloneElementDeep)
  }

  read(): CanvasElement[] {
    return this.elements.map(cloneElementDeep)
  }

  // Null when there is nothing to serialize.
  serialize(): string | null {
    if (!this.hasContent()) {
      return null
    }
    if (this.serializeFn) {
      return this.serializeFn(this.read())
    }
    const envelope: ClipboardEnvelope = {
      elements: this.read(),
      type: CLIPBOARD_TYPE,
      version: CLIPBOARD_VERSION,
    }
    return JSON.stringify(envelope)
  }

  // Returns false when the data is rejected; the existing buffer is kept.
  deserialize(data: string): boolean {
    const elements = this.deserializeFn
      ? this.deserializeFn(data)
      : parseDefault(data)
    if (
      !elements ||
      elements.length === 0 ||
      !elements.every(isCanvasElement)
    ) {
      return false
    }
    this.write(elements)
    return true
  }
}
