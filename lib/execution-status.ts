/**
 * Per-node execution status, derived from the Canvas's execution state
 * and passed to each node component as a prop. Drives the ring color
 * (blue=running, emerald=success, red=error) shown on the node card.
 *
 * `"idle"` is the default and means "not part of the current run" or
 * "finished a previous run and was cleared".
 */
export type NodeExecutionStatus = "idle" | "running" | "success" | "error"
