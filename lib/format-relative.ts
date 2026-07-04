/**
 * Format an ISO timestamp as a short relative-time string.
 *
 * MUST be called on the server only — it uses `Date.now()` which produces a
 * different value on the server (during SSR) vs the client (during hydration),
 * and would cause a hydration mismatch if rendered from a client component.
 *
 * Callers: pass the formatted string as a prop to client components.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`
  return new Date(iso).toLocaleDateString()
}