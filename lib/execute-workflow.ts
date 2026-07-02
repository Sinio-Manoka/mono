import type { Edge, Node } from "@xyflow/react"

import type {
  NodeData,
  RequestNodeData,
  TriggerNodeData,
} from "@/components/nodes/types"

/**
 * Workflow execution engine.
 *
 * Walks the graph from a starting node (the Manuell trigger) and runs each
 * node in topological order via a breadth-first traversal. Each step is
 * `yield`ed to the caller so the UI can update between nodes — the current
 * node can be highlighted, the Inspector can show the result, the Execute
 * button can show a spinner.
 *
 * Output flow: the trigger produces a small envelope (`{ type, startedAt,
 * input }`) that becomes the `input` argument for the next node. Each
 * request node makes a real `fetch` and returns `{ status, statusText, body }`.
 * Subsequent nodes receive the previous node's return value as `input`.
 *
 * Error handling: a node that throws is caught and surfaced as an
 * `ExecutionStep` of kind `"error"`. The engine then STOPS following
 * that branch (no downstream nodes are queued for it) so a single bad
 * node doesn't poison the rest of the run, but the engine continues with
 * any other branches that were already in the queue.
 */

export type ExecutionStep =
  | { type: "start"; nodeId: string }
  | { type: "success"; nodeId: string; result: unknown }
  | { type: "error"; nodeId: string; error: string }

type NodeExecutor = (node: Node, input: unknown) => Promise<unknown>

const executors: Record<string, NodeExecutor> = {
  trigger: async (node, input) => {
    const data = node.data as TriggerNodeData
    return {
      type: data.triggerType ?? "manual",
      startedAt: Date.now(),
      input,
    }
  },
  request: async (node, input) => {
    const data = node.data as RequestNodeData
    const url = data.url?.trim()
    if (!url) {
      throw new Error("No URL configured for this request node")
    }
    const method = (data.method ?? "GET").toUpperCase()
    let response: Response
    try {
      response = await fetch(url, {
        method,
        // Don't send the previous node's raw `input` as the body by
        // default — callers can opt in later. For now, just hit the URL.
      })
    } catch (err) {
      // The browser throws `TypeError` for the most common fetch failure
      // modes (CORS preflight denied, DNS failure, offline, mixed-content
      // block, invalid URL). Surface a single, readable message that names
      // the likely causes instead of leaking the raw `TypeError` text.
      const raw = err instanceof Error ? err.message : String(err)
      const isLikelyCors =
        raw.toLowerCase().includes("failed to fetch") ||
        raw.toLowerCase().includes("networkerror") ||
        raw.toLowerCase().includes("network error")
      if (isLikelyCors) {
        throw new Error(
          `Could not reach ${url}. This is usually one of:\n` +
            `  • CORS — the target server didn't allow this origin\n` +
            `  • Offline / DNS / unreachable host\n` +
            `  • Mixed-content (http:// from an https:// page)\n` +
            `  • Invalid URL`
        )
      }
      throw new Error(`Request failed: ${raw}`)
    }
    const body = await response.text()
    let parsed: unknown = body
    try {
      parsed = body ? JSON.parse(body) : body
    } catch {
      // Body wasn't JSON — keep the raw text under `bodyRaw`.
      parsed = { bodyRaw: body }
    }
    return {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      input,
      body: parsed,
    }
  },
}

export async function* executeWorkflow(
  nodes: Node<NodeData>[],
  edges: Edge[],
  startId: string
): AsyncGenerator<ExecutionStep> {
  const visited = new Set<string>()
  // BFS queue: each entry knows the input it should pass to its node.
  const queue: { nodeId: string; input: unknown }[] = [
    { nodeId: startId, input: null },
  ]

  while (queue.length > 0) {
    const { nodeId, input } = queue.shift()!
    if (visited.has(nodeId)) continue
    visited.add(nodeId)

    const node = nodes.find((n) => n.id === nodeId)
    if (!node) continue

    yield { type: "start", nodeId }

    try {
      const executor = executors[node.type ?? ""]
      if (!executor) {
        throw new Error(`No executor registered for node type "${node.type}"`)
      }
      const result = await executor(node, input)
      yield { type: "success", nodeId, result }

      // Queue downstream nodes in the order the edges were authored, so
      // the user sees a predictable top-to-bottom execution flow.
      const outgoing = edges.filter((e) => e.source === nodeId)
      for (const edge of outgoing) {
        queue.push({ nodeId: edge.target, input: result })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      yield { type: "error", nodeId, error: message }
      // Do NOT queue downstream nodes for a failed branch — the result
      // is undefined and we'd just be cascading the failure.
    }
  }
}
