"use client"

import { useCallback, useEffect, useRef } from "react"

/**
 * Register a window keydown handler that always sees the latest
 * snapshot of `state` without re-binding on every render. Canonical
 * React pattern for "stable listener, fresh values" — avoids the
 * cost of `removeEventListener` / `addEventListener` on every
 * render of the host component (the keydown deps otherwise change
 * whenever the underlying arrays do, which happens constantly
 * during editor work).
 *
 * Usage:
 *   useKeyboardShortcuts(
 *     (event, state) => {
 *       if ((event.ctrlKey || event.metaKey) && event.key === "s") {
 *         event.preventDefault()
 *         doSave(state.nodes)
 *       }
 *     },
 *     { nodes, edges, hasChanges }
 *   )
 *
 * Returning a truthy value from the handler also calls `preventDefault`
 * for callers that don't want to repeat that boilerplate.
 */

export function useKeyboardShortcuts<S>(
  handler: (event: KeyboardEvent, state: S) => void | boolean,
  state: S
) {
  // Stash the latest state in a ref so the registered handler always
  // reads fresh values through indirection. The registered closure
  // captures `stateRef` (stable) and `handler` (stable), so we don't
  // need the deps to drive re-binding.
  const stateRef = useRef(state)
  stateRef.current = state

  // Use `useCallback` so this wrapper identity is stable across renders
  // with the same `handler`. The handler reference is allowed to
  // change on every render of the host — `handlerRef` keeps it fresh
  // without forcing the window listener to re-bind.
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  const stableHandler = useCallback((event: KeyboardEvent) => {
    const handled = handlerRef.current(event, stateRef.current)
    if (handled) event.preventDefault()
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", stableHandler)
    return () => window.removeEventListener("keydown", stableHandler)
  }, [stableHandler])
}