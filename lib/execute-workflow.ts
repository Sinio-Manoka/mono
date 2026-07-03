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
    let url = data.url?.trim()
    if (!url) {
      throw new Error("No URL configured for this request node")
    }

    const method = (data.method ?? "GET").toUpperCase()

    // Parse and append query parameters to URL
    if (data.queryParams?.trim()) {
      try {
        const params = JSON.parse(data.queryParams)
        const searchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
          searchParams.append(key, String(value))
        }
        const separator = url.includes("?") ? "&" : "?"
        url = `${url}${separator}${searchParams.toString()}`
      } catch (err) {
        throw new Error(`Invalid query parameters JSON: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Parse headers
    let headers: Record<string, string> = {}
    if (data.headers?.trim()) {
      try {
        headers = JSON.parse(data.headers)
      } catch (err) {
        throw new Error(`Invalid headers JSON: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Add Bearer token if provided
    if (data.authToken?.trim()) {
      headers["Authorization"] = `Bearer ${data.authToken.trim()}`
    }

    // Parse body
    let body: string | undefined
    if (data.body?.trim()) {
      try {
        // If it's JSON, validate it; otherwise send as-is
        JSON.parse(data.body)
        body = data.body
      } catch {
        // Not JSON, send as plain text
        body = data.body
      }
    }

    let response: Response
    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      }
      if (body) {
        fetchOptions.body = body
      }
      response = await fetch(url, fetchOptions)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)

      // Provide helpful error messages
      if (raw.toLowerCase().includes("failed to fetch") ||
          raw.toLowerCase().includes("networkerror") ||
          raw.toLowerCase().includes("network error")) {
        throw new Error(
          `Could not reach ${url}\n\nCommon causes:\n` +
          `• Invalid URL format\n` +
          `• Server is offline or unreachable\n` +
          `• Network connectivity issue\n` +
          `• DNS resolution failed\n\n` +
          `Tip: Try a public API like:\n` +
          `https://jsonplaceholder.typicode.com/posts`
        )
      }

      if (raw.toLowerCase().includes("cors")) {
        throw new Error(
          `CORS Error: Server blocked this request.\n\n` +
          `The server doesn't allow requests from this origin.\n` +
          `Try using a public CORS-enabled API instead.`
        )
      }

      throw new Error(`Request failed: ${raw}`)
    }

    const responseBody = await response.text()
    let parsed: unknown = responseBody
    try {
      parsed = responseBody ? JSON.parse(responseBody) : responseBody
    } catch {
      parsed = { bodyRaw: responseBody }
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
