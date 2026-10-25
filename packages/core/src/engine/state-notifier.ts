import type { CanvasEngine } from "./engine"

/**
 * The slices of engine state that can change independently. Consumers such as
 * the DOM adapter and {@link AdrawStore} use the kind to avoid work on
 * unrelated changes.
 *
 * @internal
 */
export type StateChangeKind =
  | "elements"
  | "selection"
  | "viewport"
  | "tool"
  | "style"
  | "snapping"
  | "toolLock"
  | "overlay"
  | "history"
  | "mount"

type StateListener = (kind: StateChangeKind) => void

const listeners = new WeakMap<CanvasEngine, Set<StateListener>>()

/**
 * Subscribe to internal engine state changes. Returns an unsubscribe function.
 *
 * @internal
 */
export function subscribeState(
  engine: CanvasEngine,
  listener: StateListener,
): () => void {
  let set = listeners.get(engine)
  if (!set) {
    set = new Set()
    listeners.set(engine, set)
  }
  set.add(listener)

  return () => {
    const current = listeners.get(engine)
    current?.delete(listener)
    if (current?.size === 0) {
      listeners.delete(engine)
    }
  }
}

/**
 * Notify subscribers that one slice of engine state changed. Iterating over a
 * copy lets a listener unsubscribe while the notification is running.
 *
 * @internal
 */
export function notifyState(engine: CanvasEngine, kind: StateChangeKind): void {
  const set = listeners.get(engine)
  if (!set) {
    return
  }
  for (const listener of set) {
    listener(kind)
  }
}
