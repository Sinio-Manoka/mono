/**
 * Walk a dotted / bracketed path against a JSON-like value.
 *
 * Supports both `a.b.c` (object-key access) and `a[0].b` (array-index
 * access) in any combination — e.g. `body[0].items[2].name`. Whichever
 * notation the user types into an `{{...}}` expression will round-trip
 * through the executor and the in-editor validity check identically,
 * so what reads "valid" in the inspector will actually resolve at run
 * time.
 *
 * Returns `undefined` for any miss: unknown key, out-of-bounds index,
 * traversing into a primitive, or traversing into `null`/`undefined`.
 * Callers that need to distinguish "missing" from "present but null"
 * should compare against `undefined` rather than relying on truthiness.
 */
export function resolvePath(value: unknown, path: string): unknown {
  // Tokenize. `.` and `[` start a new token; `]` closes the current one.
  // Anything between is the token text. `a.b[0].c` → ["a", "b", "0", "c"].
  const tokens: string[] = []
  let buffer = ""
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]
    if (ch === "." || ch === "[" || ch === "]") {
      if (buffer) {
        tokens.push(buffer)
        buffer = ""
      }
    } else {
      buffer += ch
    }
  }
  if (buffer) tokens.push(buffer)

  let current: unknown = value
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current)) {
      const idx = Number(token)
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) {
        return undefined
      }
      current = current[idx]
      continue
    }
    if (typeof current === "object") {
      const record = current as Record<string, unknown>
      if (!(token in record)) return undefined
      current = record[token]
      continue
    }
    // Trying to descend into a primitive — path doesn't fit.
    return undefined
  }
  return current
}