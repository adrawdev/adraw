import type { CanvasEngine } from "./engine"

/**
 * The slices of engine state that can change independently. Consumers such as
 * the DOM adapter and {@link AdrawStore} use the kinds to avoid work on
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

/**
 * The complete set of slices changed by one canvas operation.
 *
 * @internal
 */
export type StateChange = ReadonlySet<StateChangeKind>

type StateListener = (change: StateChange) => void

interface StateOperation {
  depth: number
  pending: Set<StateChangeKind>
}

interface DispatchOutcome {
  error?: unknown
  failed: boolean
}

const listeners = new WeakMap<CanvasEngine, Set<StateListener>>()
const operations = new WeakMap<CanvasEngine, StateOperation>()

/**
 * Subscribe to internal engine state changes. The listener receives the
 * deduplicated kinds changed by one operation, after the operation completes.
 * Returns an unsubscribe function.
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

function dispatchState(
  engine: CanvasEngine,
  change: StateChange,
): DispatchOutcome {
  const set = listeners.get(engine)
  if (!set?.size) {
    return { failed: false }
  }

  let failed = false
  let failure: unknown
  const currentListeners = new Set(set)
  for (const listener of currentListeners) {
    try {
      listener(change)
    } catch (error) {
      if (!failed) {
        failed = true
        failure = error
      }
    }
  }
  return failed ? { error: failure, failed } : { failed }
}

function getOperation(engine: CanvasEngine): StateOperation {
  let operation = operations.get(engine)
  if (!operation) {
    operation = { depth: 0, pending: new Set() }
    operations.set(engine, operation)
  }
  return operation
}

/**
 * Run one synchronous canvas operation. State changes are collected for the
 * outermost operation and published once, after it completes. Nested operations
 * join the outer scope. State is still published when the operation throws; a
 * listener error is surfaced only when the operation itself succeeded.
 *
 * @internal
 */
export function runStateOperation<T>(
  engine: CanvasEngine,
  operation: () => T,
): T {
  const scope = getOperation(engine)
  scope.depth += 1

  let operationFailed = false
  let operationError: unknown
  let result: T | undefined
  try {
    result = operation()
  } catch (error) {
    operationFailed = true
    operationError = error
  }
  scope.depth -= 1

  let dispatch: DispatchOutcome = { failed: false }
  if (scope.depth === 0) {
    const pending = scope.pending
    scope.pending = new Set()
    if (pending.size > 0) {
      dispatch = dispatchState(engine, pending)
    }
  }

  if (operationFailed) {
    throw operationError
  }
  if (dispatch.failed) {
    throw dispatch.error
  }
  return result as T
}

/**
 * Record that one slice of engine state changed. Inside
 * {@link runStateOperation}, the kind joins the pending operation. Outside an
 * operation it is published immediately.
 *
 * @internal
 */
export function notifyState(engine: CanvasEngine, kind: StateChangeKind): void {
  const operation = operations.get(engine)
  if (operation && operation.depth > 0) {
    operation.pending.add(kind)
    return
  }

  const dispatch = dispatchState(engine, new Set([kind]))
  if (dispatch.failed) {
    throw dispatch.error
  }
}
