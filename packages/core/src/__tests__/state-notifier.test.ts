import { describe, expect, it, vi } from "vitest"

import { CanvasEngine } from "../engine/engine"
import {
  notifyState,
  runStateOperation,
  subscribeState,
} from "../engine/state-notifier"

describe("state notifier", () => {
  it("coalesces nested operation kinds into one dispatch", () => {
    const engine = new CanvasEngine()
    const heard: string[][] = []
    subscribeState(engine, (change) => {
      heard.push([...change].toSorted())
    })

    runStateOperation(engine, () => {
      notifyState(engine, "elements")
      runStateOperation(engine, () => {
        notifyState(engine, "selection")
      })
      notifyState(engine, "history")
      notifyState(engine, "elements")
    })

    expect(heard).toEqual([["elements", "history", "selection"]])
  })

  it("publishes after a failed operation and preserves its error", () => {
    const engine = new CanvasEngine()
    const listener = vi.fn()
    const listenerError = new Error("listener failed")
    const operationError = new Error("operation failed")
    subscribeState(engine, () => {
      listener()
      throw listenerError
    })

    expect(() =>
      runStateOperation(engine, () => {
        notifyState(engine, "elements")
        throw operationError
      }),
    ).toThrow(operationError)
    expect(listener).toHaveBeenCalledOnce()
  })

  it("dispatches to the listener set captured at publication start", () => {
    const engine = new CanvasEngine()
    const heard: string[] = []
    let unsubscribeSecond = () => {}
    const firstError = new Error("first listener failed")

    subscribeState(engine, () => {
      heard.push("first")
      unsubscribeSecond()
      throw firstError
    })
    unsubscribeSecond = subscribeState(engine, () => {
      heard.push("second")
    })

    expect(() =>
      runStateOperation(engine, () => {
        notifyState(engine, "elements")
      }),
    ).toThrow(firstError)
    expect(heard).toEqual(["first", "second"])
  })

  it("surfaces the first listener error only after every listener ran", () => {
    const engine = new CanvasEngine()
    const firstError = new Error("first")
    const secondError = new Error("second")
    const heard: string[] = []

    subscribeState(engine, () => {
      heard.push("first")
      throw firstError
    })
    subscribeState(engine, () => {
      heard.push("second")
      throw secondError
    })
    subscribeState(engine, () => {
      heard.push("third")
    })

    expect(() =>
      runStateOperation(engine, () => {
        notifyState(engine, "elements")
      }),
    ).toThrow(firstError)
    expect(heard).toEqual(["first", "second", "third"])
  })

  it("does not dispatch when an operation records no changes", () => {
    const engine = new CanvasEngine()
    const listener = vi.fn()
    subscribeState(engine, listener)

    runStateOperation(engine, () => {})

    expect(listener).not.toHaveBeenCalled()
  })
})
