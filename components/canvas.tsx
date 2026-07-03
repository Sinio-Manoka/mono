"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconLoader2, IconPlayerPlay } from "@tabler/icons-react"
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import { TriggerNode } from "@/components/nodes/trigger-node"
import { RequestNode } from "@/components/nodes/request-node"
import {
  UNIQUE_CATALOG_KEYS,
  type NodeData,
  type NodeType,
  type RequestNodeData,
  type TriggerNodeData,
} from "@/components/nodes/types"
import type { NodeExecutionStatus } from "@/lib/execution-status"
import { Inspector } from "@/components/inspector"
import { Sidebar } from "@/components/sidebar"

// Wrap each node component so it receives an `onUpdate` callback bound
// to its own id AND its current execution status. The wrapper takes
// the generic `NodeProps` (what React Flow's `nodeTypes` map expects)
// and casts to the typed `NodeProps` per component.
//
// Recreated via `useMemo` keyed on `updateNodeData` (stable) and
// `execution` (changes per-step), so the wrappers pick up the latest
// execution results without re-rendering on every canvas keystroke.
const nodeTypesFor = (
  updateNodeData: (id: string, patch: Partial<NodeData>) => void,
  getStatus: (nodeId: string) => NodeExecutionStatus
) => ({
  trigger: (props: NodeProps) => {
    const typed = props as NodeProps<Node<TriggerNodeData>>
    return (
      <TriggerNode
        {...typed}
        onUpdate={(patch) => updateNodeData(typed.id, patch)}
        executionStatus={getStatus(typed.id)}
      />
    )
  },
  request: (props: NodeProps) => {
    const typed = props as NodeProps<Node<RequestNodeData>>
    return (
      <RequestNode
        {...typed}
        onUpdate={(patch) => updateNodeData(typed.id, patch)}
        executionStatus={getStatus(typed.id)}
      />
    )
  },
})

const initialNodes: Node<NodeData>[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 0, y: 0 },
    data: { label: "On Request", triggerType: "request" },
  },
  {
    id: "request-1",
    type: "request",
    position: { x: 280, y: 0 },
    data: {
      label: "HTTP Request",
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts",
      headers: '{"Content-Type": "application/json"}',
    },
  },
]

const initialEdges: Edge[] = [{ id: "e1", source: "trigger-1", target: "request-1" }]

/**
 * Maps React Flow's user-facing CSS variables to the shadcn tokens defined in
 * `app/globals.css`. Set inline on the wrapper so Tailwind v4's CSS tree-shake
 * doesn't strip them as "unused" (the references live in
 * `node_modules/@xyflow/react/dist/style.css`, which Tailwind doesn't scan).
 * Because the shadcn tokens themselves change with `[data-theme="dark"]`, the
 * RF colors automatically follow light/dark mode without any duplication here.
 */
const reactFlowThemeStyle = {
  "--xy-background-color": "var(--background)",
  "--xy-background-pattern-color": "var(--border)",

  "--xy-edge-stroke": "var(--muted-foreground)",
  "--xy-edge-stroke-selected": "var(--primary)",
  "--xy-connectionline-stroke-color": "var(--primary)",
  "--xy-edge-label-background-color": "var(--card)",
  "--xy-edge-label-color": "var(--card-foreground)",

  "--xy-handle-background-color": "var(--muted-foreground)",
  "--xy-handle-border-color": "var(--background)",

  "--xy-selection-background-color":
    "color-mix(in oklch, var(--primary) 8%, transparent)",
  "--xy-selection-border": "1px dashed var(--primary)",

  "--xy-controls-button-background-color": "var(--card)",
  "--xy-controls-button-background-color-hover": "var(--accent)",
  "--xy-controls-button-color": "var(--card-foreground)",
  "--xy-controls-button-color-hover": "var(--accent-foreground)",
  "--xy-controls-button-border-color": "var(--border)",
  "--xy-controls-box-shadow": "0 0 0 1px var(--border)",

  "--xy-minimap-background-color": "var(--card)",
  "--xy-minimap-mask-background-color":
    "color-mix(in oklch, var(--foreground) 6%, transparent)",
  "--xy-minimap-mask-stroke-color": "var(--border)",
  "--xy-minimap-node-background-color": "var(--muted)",
  "--xy-minimap-node-stroke-color": "var(--border)",

  "--xy-attribution-background-color":
    "color-mix(in oklch, var(--card) 80%, transparent)",

  "--xy-node-boxshadow-hover":
    "0 1px 4px 1px color-mix(in oklch, var(--foreground) 6%, transparent)",
  "--xy-node-boxshadow-selected": "0 0 0 2px var(--ring)",
} as React.CSSProperties

export function Canvas() {
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  // The inspector is driven by a dedicated id, not by React Flow's built-in
  // `selected` flag. That way single-click can still set the visual selection
  // (the ring on the node) without opening the drawer — only a double click
  // opens it.
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null)
  // `saveState` drives the Save button's transient feedback (the spinner /
  // brief "Saved!" toast). The persistent "saved" vs "dirty" state comes
  // from `hasChanges`, which is a memoized comparison of the current canvas
  // state against the last successfully-saved snapshot.
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle")
  // Stringified snapshot of the last persisted state. State (not a ref)
  // so updating it triggers a re-render and the `hasChanges` memo below
  // re-evaluates — refs can't be read during render, and reading
  // `lastSavedSnapshotRef.current` inside a `useMemo` would trip the
  // `react-hooks/refs` lint rule.
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>("")

  // Undo history: stores previous states of the canvas for Ctrl+Z
  // Only tracks major changes (node/edge additions/removals)
  const [history, setHistory] = useState<{ nodes: Node<NodeData>[]; edges: Edge[]; timestamp: number; description: string }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoingRef = useRef(false)
  const lastSnapshotRef = useRef<{ nodeCount: number; edgeCount: number; nodeIds: string[]; edgeIds: string[] } | null>(null)

  // On mount, load the persisted workflow from the API. If a snapshot
  // exists, replace the default `initialNodes` / `initialEdges` with it
  // AND record it as the "last saved" baseline so the Save button starts
  // in its "Saved" (clean) state. A failure (404 / network) just keeps
  // the defaults — the user still sees the example flow, and `hasChanges`
  // will report dirty so they can save it for the first time.
  useEffect(() => {
    let cancelled = false
    fetch("/api/workflow")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { nodes?: Node<NodeData>[]; edges?: Edge[] } | null) => {
        if (cancelled || !data) return
        if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          if (data.nodes.length > 0 || data.edges.length > 0) {
            setNodes(data.nodes)
            setEdges(data.edges)
            setLastSavedSnapshot(
              JSON.stringify({ nodes: data.nodes, edges: data.edges })
            )
          }
          // Empty snapshot on the server — leave `lastSavedSnapshot` as
          // "" so the current default state reads as dirty.
        }
      })
      .catch(() => {
        // Network error — keep the defaults. No user-visible error needed
        // for the first-load case.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Track only major changes (node/edge additions/removals) to history
  useEffect(() => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false
      return
    }

    const currentSnapshot = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeIds: nodes.map(n => n.id).sort(),
      edgeIds: edges.map(e => e.id).sort(),
    }

    const prev = lastSnapshotRef.current

    // Check if this is a major change
    let isMajorChange = false
    let description = "Initial state"

    if (!prev) {
      isMajorChange = true
      description = "Initial state"
    } else {
      const nodeIdsChanged = JSON.stringify(currentSnapshot.nodeIds) !== JSON.stringify(prev.nodeIds)
      const edgeIdsChanged = JSON.stringify(currentSnapshot.edgeIds) !== JSON.stringify(prev.edgeIds)

      if (nodeIdsChanged || edgeIdsChanged) {
        isMajorChange = true
        const nodeDiff = currentSnapshot.nodeCount - prev.nodeCount
        const edgeDiff = currentSnapshot.edgeCount - prev.edgeCount

        if (nodeDiff > 0) {
          description = `Added ${nodeDiff} node${nodeDiff > 1 ? "s" : ""}`
        } else if (nodeDiff < 0) {
          description = `Removed ${Math.abs(nodeDiff)} node${Math.abs(nodeDiff) > 1 ? "s" : ""}`
        } else if (edgeDiff > 0) {
          description = `Added ${edgeDiff} connection${edgeDiff > 1 ? "s" : ""}`
        } else if (edgeDiff < 0) {
          description = `Removed ${Math.abs(edgeDiff)} connection${Math.abs(edgeDiff) > 1 ? "s" : ""}`
        } else {
          description = "Reconnected nodes"
        }
      }
    }

    if (isMajorChange) {
      lastSnapshotRef.current = currentSnapshot
      setHistory((prevHistory) => {
        const newHistory = prevHistory.slice(0, historyIndex + 1)
        newHistory.push({ nodes, edges, timestamp: Date.now(), description })
        // Keep max 20 history entries for version panel
        if (newHistory.length > 20) newHistory.shift()
        return newHistory
      })
      setHistoryIndex((prevIdx) => Math.min(prevIdx + 1, 19))
    }
  }, [nodes, edges, historyIndex])

  // True iff the current canvas state diverges from the last persisted
  // snapshot. Drives whether the Save button reads "Save" (actionable)
  // or "Saved" (clean).
  const hasChanges = useMemo(() => {
    const current = JSON.stringify({ nodes, edges })
    return current !== lastSavedSnapshot
  }, [nodes, edges, lastSavedSnapshot])

  const handleSave = useCallback(async () => {
    setSaveState("saving")
    try {
      const snapshot = { nodes, edges }
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      // Record the now-persisted snapshot so `hasChanges` flips back to
      // false and the button reads "Saved" again.
      setLastSavedSnapshot(JSON.stringify(snapshot))
      setSaveState("saved")
      // Drop back to "idle" after a moment so the button doesn't sit on
      // "Saved!" forever.
      setTimeout(() => setSaveState("idle"), 2000)
    } catch (err) {
      console.error("[save] workflow", err)
      setSaveState("idle")
    }
  }, [nodes, edges])

  // Keyboard shortcuts: Ctrl+S to save, Ctrl+Z to undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea/contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (hasChanges && saveState !== "saving") {
          handleSave()
        }
      }

      // Ctrl+Z or Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          const prevState = history[newIndex]
          if (prevState) {
            isUndoingRef.current = true
            setHistoryIndex(newIndex)
            setNodes(prevState.nodes)
            setEdges(prevState.edges)
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasChanges, saveState, handleSave, history, historyIndex])

  const inspectorNode = useMemo(
    () => nodes.find((n) => n.id === inspectorNodeId) ?? null,
    [nodes, inspectorNodeId]
  )

  // Catalog keys that should be hidden from the picker. Right now only
  // "trigger-manual" is limited to one — the workflow can have at most a
  // single Manuell start node. Adding more limits is a matter of extending
  // UNIQUE_CATALOG_KEYS and this check.
  const disabledCatalogKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const key of UNIQUE_CATALOG_KEYS) {
      if (key === "trigger-manual") {
        const has = nodes.some(
          (n) =>
            n.type === "trigger" &&
            (n.data as TriggerNodeData).triggerType === "manual"
        )
        if (has) keys.add(key)
      }
    }
    return keys
  }, [nodes])

  // Whether a Manuell trigger is currently on the canvas. The Execute
  // button only makes sense when there's something to execute, so it's
  // gated on this.
  const hasManuellTrigger = useMemo(
    () =>
      nodes.some(
        (n) =>
          n.type === "trigger" &&
          (n.data as TriggerNodeData).triggerType === "manual"
      ),
    [nodes]
  )

  // Workflow execution: per-node status and aggregated results/errors.
  // Transient state — not persisted, not part of the dirty snapshot.
  const [execution, setExecution] = useState<{
    running: boolean
    /** Node currently being executed (drives the blue pulsing ring). */
    currentNodeId: string | null
    /** Successful return values keyed by nodeId. */
    results: Record<string, unknown>
    /** Error messages keyed by nodeId. */
    errors: Record<string, string>
    startedAt: number | null
    finishedAt: number | null
  }>({
    running: false,
    currentNodeId: null,
    results: {},
    errors: {},
    startedAt: null,
    finishedAt: null,
  })

  const handleExecuteWorkflow = useCallback(async () => {
    // Find the Manuell trigger. The button only shows when one exists,
    // so this is just a guard.
    const trigger = nodes.find(
      (n) =>
        n.type === "trigger" &&
        (n.data as TriggerNodeData).triggerType === "manual"
    )
    if (!trigger) return

    setExecution({
      running: true,
      currentNodeId: null,
      results: {},
      errors: {},
      startedAt: Date.now(),
      finishedAt: null,
    })

    try {
      const response = await fetch("/api/execute-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          startId: trigger.id,
        }),
      })

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.status}`)
      }

      // Read the streaming NDJSON response
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue
          const step = JSON.parse(line)

          setExecution((prev) => {
            if (step.type === "start") {
              return { ...prev, currentNodeId: step.nodeId }
            }
            if (step.type === "success") {
              return {
                ...prev,
                currentNodeId: null,
                results: { ...prev.results, [step.nodeId]: step.result },
              }
            }
            return {
              ...prev,
              currentNodeId: null,
              errors: { ...prev.errors, [step.nodeId]: step.error },
            }
          })
        }
      }
    } catch (err) {
      console.error("[execute] workflow failed", err)
    } finally {
      setExecution((prev) => ({
        ...prev,
        running: false,
        currentNodeId: null,
        finishedAt: Date.now(),
      }))
    }
  }, [nodes, edges])

  // Serialize the current workflow to a JSON file and trigger a browser
  // download. The filename includes a timestamp so successive downloads
  // don't overwrite each other in the user's Downloads folder.
  const handleDownload = useCallback(() => {
    const workflow = { nodes, edges }
    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, "0")
    const stamp =
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
      `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    a.download = `workflow-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  // Open a file picker, read the selected file as JSON, and replace the
  // current canvas with the parsed workflow. The loaded JSON is also
  // recorded as the "last saved" baseline so the Save button reads
  // "Saved" (clean) rather than "Save" (dirty) right after import.
  const handleLoad = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json,.json"
    input.style.display = "none"
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) {
        document.body.removeChild(input)
        return
      }
      const reader = new FileReader()
      reader.onload = (readEvent) => {
        try {
          const text = readEvent.target?.result
          if (typeof text !== "string") {
            throw new Error("File is not text")
          }
          const parsed = JSON.parse(text) as {
            nodes?: Node<NodeData>[]
            edges?: Edge[]
          }
          if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
            throw new Error(
              "Missing `nodes` or `edges` array in the workflow file"
            )
          }
          setNodes(parsed.nodes)
          setEdges(parsed.edges)
          // Treat the loaded file as the new baseline — no unsaved changes.
          setLastSavedSnapshot(text)
          setSaveState("saved")
          setTimeout(() => setSaveState("idle"), 2000)
        } catch (err) {
          console.error("[load] invalid workflow file", err)
        } finally {
          document.body.removeChild(input)
        }
      }
      reader.onerror = () => {
        console.error("[load] failed to read file")
        document.body.removeChild(input)
      }
      reader.readAsText(file)
    }
    document.body.appendChild(input)
    input.click()
  }, [])

  const updateNodeData = useCallback(
    (id: string, patch: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        )
      )
    },
    []
  )

  const deleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) =>
      eds.filter((e) => e.source !== id && e.target !== id)
    )
  }, [])

  const addNode = useCallback(
    (type: NodeType, initialData?: Partial<NodeData>) => {
      setNodes((nds) => {
        // Place each new node on an 8-wide grid that starts at (100, 100)
        // and wraps every 8 columns, so successive picks produce a tidy
        // diagonal cascade instead of overlapping at a single point.
        const index = nds.length
        const col = index % 8
        const row = Math.floor(index / 8)
        const id = `${type}-${Date.now().toString(36)}-${index}`
        const defaults: NodeData =
          type === "trigger"
            ? { label: "New trigger", triggerType: "manual" }
            : { label: "New request", method: "GET" }
        const data: NodeData = { ...defaults, ...initialData }
        return [
          ...nds,
          {
            id,
            type,
            position: { x: 100 + col * 200, y: 100 + row * 160 },
            data,
          },
        ]
      })
    },
    []
  )

  const closeInspector = useCallback(() => {
    setInspectorNodeId(null)
  }, [])

  // Stable handlers for React Flow. Re-creating them on every render forces
  // RF to re-bind its event listeners and, in v12 + React 19, can stall the
  // next pointer event by a frame or two — which is what was making the
  // "delete then click another node" interaction feel like 1-2s of lag.
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )
  const handleConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection }, eds)),
    []
  )
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node<NodeData>) => {
      setInspectorNodeId(node.id)
    },
    []
  )
  const handlePaneClick = useCallback(() => closeInspector(), [closeInspector])

  // Derive each node's execution status from the current execution
  // state. `currentNodeId` is the one currently running; everything
  // else in `results`/`errors` is terminal. New runs clear both maps
  // when the engine starts, so the status resets cleanly.
  const getNodeExecutionStatus = useCallback(
    (nodeId: string): NodeExecutionStatus => {
      if (execution.currentNodeId === nodeId) return "running"
      if (execution.errors[nodeId] !== undefined) return "error"
      if (execution.results[nodeId] !== undefined) return "success"
      return "idle"
    },
    [execution]
  )

  // Restore canvas state from history
  const handleRestoreHistory = useCallback((index: number) => {
    const entry = history[index]
    if (entry) {
      isUndoingRef.current = true
      lastSnapshotRef.current = {
        nodeCount: entry.nodes.length,
        edgeCount: entry.edges.length,
        nodeIds: entry.nodes.map(n => n.id).sort(),
        edgeIds: entry.edges.map(e => e.id).sort(),
      }
      setHistoryIndex(index)
      setNodes(entry.nodes)
      setEdges(entry.edges)
    }
  }, [history])

  // Delete a version from history
  const handleDeleteHistory = useCallback((index: number) => {
    setHistory((prev) => {
      const newHistory = prev.filter((_, i) => i !== index)
      return newHistory
    })
    // Adjust index if needed
    if (historyIndex >= index) {
      setHistoryIndex((prev) => Math.max(0, prev - 1))
    }
  }, [historyIndex])

  // Download a specific version as JSON
  const handleDownloadHistory = useCallback((entry: { nodes: Node<NodeData>[]; edges: Edge[]; timestamp: number; description: string }, index: number) => {
    const workflow = { nodes: entry.nodes, edges: entry.edges }
    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const date = new Date(entry.timestamp)
    const pad = (n: number) => n.toString().padStart(2, "0")
    const stamp =
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
    a.download = `workflow-v${index + 1}-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return (
    <ReactFlowProvider>
      <div
        className="relative h-svh w-full"
        style={reactFlowThemeStyle}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypesFor(updateNodeData, getNodeExecutionStatus)}
          elementsSelectable
          nodesConnectable
          deleteKeyCode={["Delete", "Backspace"]}
          // Left-drag on the pane draws a marquee to multi-select nodes.
          // Panning is moved to the middle (1) and right (2) mouse buttons
          // so the two gestures don't fight each other on a left-drag.
          selectionOnDrag
          panOnDrag={[1, 2]}
          onConnect={handleConnect}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={2} />
          <Controls />
          <MiniMap />
        </ReactFlow>

        <Sidebar
          onAddNode={addNode}
          onSave={handleSave}
          onDownload={handleDownload}
          onLoad={handleLoad}
          saveState={saveState}
          hasChanges={hasChanges}
          disabledKeys={disabledCatalogKeys}
          history={history}
          historyIndex={historyIndex}
          onRestoreHistory={handleRestoreHistory}
          onDeleteHistory={handleDeleteHistory}
          onDownloadHistory={handleDownloadHistory}
          className="absolute top-4 right-4 z-10"
        />

        {hasManuellTrigger ? (
          <Button
            type="button"
            onClick={handleExecuteWorkflow}
            disabled={execution.running}
            className="absolute top-4 left-1/2 z-10 -translate-x-1/2 gap-2 rounded-full bg-gradient-to-r from-primary to-primary/80 px-8 py-3 font-semibold tracking-tight text-primary-foreground shadow-xl transition-all hover:shadow-2xl hover:scale-105 disabled:opacity-60 disabled:scale-100"
            size="lg"
          >
            {execution.running ? (
              <IconLoader2 className="size-5 animate-spin" stroke={2} aria-hidden />
            ) : (
              <IconPlayerPlay className="size-5 fill-current" stroke={1.5} aria-hidden />
            )}
            {execution.running ? "Running…" : "Execute"}
          </Button>
        ) : null}
      </div>

      <Inspector
        // Keying on the inspector node id (instead of the array) means the
        // form remounts each time the drawer targets a different node, which
        // keeps the local input state fresh.
        key={inspectorNode?.id ?? "empty"}
        // Passing `null` when the node has been deleted (or never existed)
        // also closes the drawer — Vaul calls `onOpenChange(false)` and we
        // clear `inspectorNodeId` in response.
        nodeId={inspectorNode?.id ?? null}
        nodeType={
          inspectorNode &&
          (inspectorNode.type === "trigger" || inspectorNode.type === "request")
            ? inspectorNode.type
            : null
        }
        data={inspectorNode?.data ?? {}}
        // Execution log for the currently selected node — the Inspector
        // shows the last result (or error) below the form so the user
        // can see what each step produced.
        nodeResult={
          inspectorNode
            ? execution.results[inspectorNode.id]
            : undefined
        }
        nodeError={
          inspectorNode
            ? execution.errors[inspectorNode.id]
            : undefined
        }
        isRunning={execution.running}
        onChange={(patch) =>
          inspectorNode ? updateNodeData(inspectorNode.id, patch) : undefined
        }
        onDelete={() =>
          inspectorNode ? deleteNode(inspectorNode.id) : undefined
        }
        onOpenChange={(open) => {
          if (!open) closeInspector()
        }}
      />
    </ReactFlowProvider>
  )
}
