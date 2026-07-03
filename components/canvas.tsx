"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconBolt, IconLoader2 } from "@tabler/icons-react"
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
import type { HistoryEntry } from "@/components/history-panel"
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts"

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

type CanvasProps = {
  /** Workflow id pulled from the route (`/[id]/workflow`). Currently
   *  informational — the storage layer is still the single shared
   *  `data/workflow.json` — but plumbed through so the API calls can
   *  be split per-workflow without re-wiring the page. */
  workflowId?: string
}

export function Canvas({ workflowId }: CanvasProps = {}) {
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

  // Undo / redo history. `history` is the forward stack up to
  // `historyIndex`; anything past that index lives in `redoStack` so
  // Ctrl+Z walks backward through history and Ctrl+Shift+Z walks
  // forward through redoStack. Making a new edit truncates the redo
  // stack (you can't redo into a branched timeline).
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const isUndoingRef = useRef(false)
  const isRedoingRef = useRef(false)
  const lastSnapshotRef = useRef<{
    nodeCount: number
    edgeCount: number
    nodeIds: string[]
    edgeIds: string[]
    // Content fingerprint so the effect can tell "state unchanged"
    // apart from "user actually edited something". Used by the
    // data-change check below.
    nodesJson: string
    edgesJson: string
  } | null>(null)

  // Preview state: when hovering a history entry, show that version
  const [previewEntry, setPreviewEntry] = useState<HistoryEntry | null>(null)

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<{
    nodes: Node<NodeData>[]
    edges: Edge[]
  } | null>(null)

  // On mount, load the persisted workflow from the API. If a snapshot
  // exists, replace the default `initialNodes` / `initialEdges` with it
  // AND record it as the "last saved" baseline so the Save button starts
  // in its "Saved" (clean) state. A failure (404 / network) just keeps
  // the defaults — the user still sees the example flow, and `hasChanges`
  // will report dirty so they can save it for the first time.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/workflow/${encodeURIComponent(workflowId ?? "default")}`)
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
  }, [workflowId])

  // Track changes to history so Ctrl+Z can step backwards one user action
  // at a time. Two kinds of changes are recorded as separate entries:
  //   - Structural: node/edge IDs change (add, remove, reconnect). Recorded
  //     immediately so the snapshot is captured the moment the action
  //     happens.
  //   - Data edits: same IDs, different content (URL, label, headers…).
  //     Debounced — a burst of typing produces one entry rather than one
  //     per keystroke. Without this, Ctrl+Z would skip past data edits
  //     and "reset" all the way back to the previous structural change.
  const dataChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const DATA_CHANGE_DEBOUNCE_MS = 800

  useEffect(() => {
    // Skip both undo AND redo: applying a history entry would otherwise
    // look like a fresh edit (different content from `lastSnapshotRef`)
    // and re-record itself, polluting the stacks.
    if (isUndoingRef.current) {
      isUndoingRef.current = false
      return
    }
    if (isRedoingRef.current) {
      isRedoingRef.current = false
      return
    }

    const currentSnapshot = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeIds: nodes.map(n => n.id).sort(),
      edgeIds: edges.map(e => e.id).sort(),
    }
    // Cheap content fingerprint so we can tell "the deps changed but
    // the canvas state is identical" apart from "the user actually
    // edited something". Without this, every re-run of this effect
    // (e.g. the `historyIndex` bump right after a `recordSnapshot`)
    // would fall into the data-change branch and schedule a fresh
    // debounce, eventually filling the history with "Edited node"
    // entries the user never asked for.
    const currentNodesJson = JSON.stringify(nodes)
    const currentEdgesJson = JSON.stringify(edges)

    const prev = lastSnapshotRef.current

    // Check if this is a major change
    let isStructuralChange = false
    let description = "Initial state"

    if (!prev) {
      isStructuralChange = true
      description = "Initial state"
    } else {
      const nodeIdsChanged = JSON.stringify(currentSnapshot.nodeIds) !== JSON.stringify(prev.nodeIds)
      const edgeIdsChanged = JSON.stringify(currentSnapshot.edgeIds) !== JSON.stringify(prev.edgeIds)

      if (nodeIdsChanged || edgeIdsChanged) {
        isStructuralChange = true
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

    // Real data change: same IDs, different content. Only meaningful
    // when we've already recorded something — the initial mount
    // already produced "Initial state" and re-recording the same
    // content on the follow-up re-run would duplicate it.
    const isDataChange =
      !!prev &&
      !isStructuralChange &&
      (currentNodesJson !== prev.nodesJson ||
        currentEdgesJson !== prev.edgesJson)

    const recordSnapshot = (desc: string) => {
      lastSnapshotRef.current = {
        ...currentSnapshot,
        nodesJson: currentNodesJson,
        edgesJson: currentEdgesJson,
      }
      const newEntry: HistoryEntry = {
        nodes,
        edges,
        timestamp: Date.now(),
        description: desc,
      }
      setHistory((prevHistory) => {
        // Truncate the future on a new branch — anything past the
        // current point is no longer reachable via redo.
        const newHistory = prevHistory.slice(0, historyIndex + 1)
        newHistory.push(newEntry)
        if (newHistory.length > 20) newHistory.shift()
        return newHistory
      })
      // Any redoable entries become unreachable — drop them so Ctrl+Shift+Z
      // doesn't rewind into a branched timeline.
      setRedoStack([])
      setHistoryIndex((prevIdx) => Math.min(prevIdx + 1, 19))
    }

    if (isStructuralChange) {
      // A structural change supersedes any pending data-edit entry —
      // there's no point recording the intermediate "edited URL of the
      // node that's about to be deleted" state.
      if (dataChangeTimerRef.current) {
        clearTimeout(dataChangeTimerRef.current)
        dataChangeTimerRef.current = null
      }
      recordSnapshot(description)
      return
    }

    if (isDataChange) {
      // Data edit: debounce so a typing burst collapses to one entry.
      // Each effect re-run clears the previous timer in the cleanup
      // below, so the entry is only recorded once the user has paused.
      dataChangeTimerRef.current = setTimeout(() => {
        recordSnapshot("Edited node")
        dataChangeTimerRef.current = null
      }, DATA_CHANGE_DEBOUNCE_MS)
    }

    return () => {
      if (dataChangeTimerRef.current) {
        clearTimeout(dataChangeTimerRef.current)
        dataChangeTimerRef.current = null
      }
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
      const res = await fetch(`/api/workflow/${encodeURIComponent(workflowId ?? "default")}`, {
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
  }, [nodes, edges, workflowId])

  // Apply one entry from the chosen stack. The current snapshot (the
  // one we're about to leave) is pushed onto the *opposite* stack so
  // undo and redo are exactly inverse. Setting `isUndoingRef` /
  // `isRedoingRef` short-circuits the history-tracking effect so the
  // re-applied state isn't recorded as a fresh edit.
  const applyFromStack = useCallback(
    (stack: "undo" | "redo") => {
      if (stack === "undo") {
        if (historyIndex <= 0) return
        const current = history[historyIndex]
        const target = history[historyIndex - 1]
        if (!target) return
        isUndoingRef.current = true
        setHistoryIndex(historyIndex - 1)
        setRedoStack((prev) =>
          current ? [...prev, current] : prev
        )
        lastSnapshotRef.current = {
          nodeCount: target.nodes.length,
          edgeCount: target.edges.length,
          nodeIds: target.nodes.map((n) => n.id).sort(),
          edgeIds: target.edges.map((e) => e.id).sort(),
          nodesJson: JSON.stringify(target.nodes),
          edgesJson: JSON.stringify(target.edges),
        }
        setNodes(target.nodes)
        setEdges(target.edges)
      } else {
        const target = redoStack[redoStack.length - 1]
        if (!target) return
        isRedoingRef.current = true
        setRedoStack((prev) => prev.slice(0, -1))
        // Grow history to include the new current state. We append the
        // target itself (not `current`) — `current` is already in
        // history at `historyIndex` so the next undo lands back there.
        setHistory((prev) => [...prev, target])
        setHistoryIndex(historyIndex + 1)
        lastSnapshotRef.current = {
          nodeCount: target.nodes.length,
          edgeCount: target.edges.length,
          nodeIds: target.nodes.map((n) => n.id).sort(),
          edgeIds: target.edges.map((e) => e.id).sort(),
          nodesJson: JSON.stringify(target.nodes),
          edgesJson: JSON.stringify(target.edges),
        }
        setNodes(target.nodes)
        setEdges(target.edges)
      }
    },
    [history, historyIndex, redoStack]
  )

  const handleUndo = useCallback(() => applyFromStack("undo"), [applyFromStack])
  const handleRedo = useCallback(() => applyFromStack("redo"), [applyFromStack])

  // Auto-save: when `hasChanges` becomes true and stays true for `AUTO_SAVE_DELAY`
  // ms, fire a save. The timer is reset every time `hasChanges` flips —
  // so a continuous burst of typing only triggers one save once the user
  // has paused, matching the same debounce pattern as the history tracker.
  const AUTO_SAVE_DELAY = 2500
  useEffect(() => {
    if (!hasChanges || saveState === "saving") return
    const id = setTimeout(() => {
      handleSave()
    }, AUTO_SAVE_DELAY)
    return () => clearTimeout(id)
  }, [hasChanges, saveState, handleSave])

  // Build a single state snapshot for the keyboard handler — this is
  // passed into the ref-stable `useKeyboardShortcuts` below so the
  // window listener is bound exactly once for the lifetime of the
  // component, instead of being torn down/re-added on every render.
  // The `{ stable refs }` pattern means we capture `nodes`/`edges`/
  // `clipboard` etc. once-per-handler rather than per-keystroke.
  const copySelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected)
    if (selectedNodes.length === 0) return false
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id))
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    )
    setClipboard({ nodes: selectedNodes, edges: selectedEdges })
    return true
  }, [nodes, edges])

  const paste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return
    const timestamp = Date.now().toString(36)
    const idMap = new Map<string, string>()

    // Create new nodes with new IDs and offset positions
    const newNodes: Node<NodeData>[] = clipboard.nodes.map((node, index) => {
      const newId = `${node.type}-${timestamp}-${index}`
      idMap.set(node.id, newId)

      // Find the base label (strip existing copy suffix)
      const baseLabel = (node.data.label ?? "Node").replace(
        / \(copy(?: \d+)?\)$/,
        ""
      )

      // Find highest existing copy number for this base label
      const copyPattern = new RegExp(
        `^${baseLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(copy(?: (\\d+))?\\)$`
      )
      let maxCopyNum = 0
      for (const n of nodes) {
        const match = (n.data.label ?? "").match(copyPattern)
        if (match) {
          maxCopyNum = Math.max(maxCopyNum, match[1] ? parseInt(match[1], 10) : 1)
        }
      }
      const nextCopyNum = maxCopyNum + 1
      const newLabel =
        nextCopyNum === 1
          ? `${baseLabel} (copy)`
          : `${baseLabel} (copy ${nextCopyNum})`

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: true,
        data: {
          ...node.data,
          label: newLabel,
        },
      }
    })

    // Create new edges with updated source/target IDs
    const newEdges: Edge[] = clipboard.edges.map((edge, index) => ({
      ...edge,
      id: `e-${timestamp}-${index}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }))

    // Deselect existing nodes and add new ones
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      ...newNodes,
    ])
    setEdges((eds) => [...eds, ...newEdges])
  }, [clipboard, nodes])

  // Keyboard shortcuts: bound ONCE for the lifetime of the page; the
  // closure inside `useKeyboardShortcuts` reads `nodes` / `edges` etc.
  // through refs so each keystroke gets fresh values without rebinding.
  useKeyboardShortcuts(
    (e, state) => {
      // Skip while typing in an input/textarea/contenteditable.
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }

      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      if (e.key === "s") {
        // Manual save — auto-save is handled elsewhere, this just
        // gives the user a "force now" path.
        if (state.hasChanges && state.saveState !== "saving") {
          state.handleSave()
        }
        return true
      }

      if (e.key === "z" && !e.shiftKey) {
        state.handleUndo()
        return true
      }

      if ((e.key === "z" && e.shiftKey) || (e.key === "y" && mod)) {
        state.handleRedo()
        return true
      }

      if (e.key === "c" && state.copySelected()) {
        return true
      }

      if (e.key === "v") {
        state.paste()
        return true
      }
    },
    {
      hasChanges,
      saveState,
      handleSave,
      handleUndo,
      handleRedo,
      copySelected,
      paste,
    }
  )

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
        // Seed the content fingerprint so the post-restore effect run
        // doesn't see the restored state as a "data change" relative
        // to a stale fingerprint.
        nodesJson: JSON.stringify(entry.nodes),
        edgesJson: JSON.stringify(entry.edges),
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
  const handleDownloadHistory = useCallback((entry: HistoryEntry, index: number) => {
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

  // Preview a history entry on hover
  const handlePreviewHistory = useCallback((entry: HistoryEntry | null) => {
    setPreviewEntry(entry)
  }, [])

  // Determine which nodes/edges to display
  const displayNodes = previewEntry ? previewEntry.nodes : nodes
  const displayEdges = previewEntry ? previewEntry.edges : edges
  const isPreviewMode = previewEntry !== null

  return (
    <ReactFlowProvider>
      <div
        className="relative h-svh w-full"
        style={{
          ...reactFlowThemeStyle,
          // Apply grayscale filter when in preview mode
          ...(isPreviewMode ? { filter: "grayscale(100%) contrast(0.9)" } : {}),
        }}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypesFor(updateNodeData, getNodeExecutionStatus)}
          elementsSelectable={!isPreviewMode}
          nodesConnectable={!isPreviewMode}
          nodesDraggable={!isPreviewMode}
          deleteKeyCode={isPreviewMode ? [] : ["Delete", "Backspace"]}
          // Left-drag on the pane draws a marquee to multi-select nodes.
          // Panning is moved to the middle (1) and right (2) mouse buttons
          // so the two gestures don't fight each other on a left-drag.
          selectionOnDrag={!isPreviewMode}
          panOnDrag={isPreviewMode ? false : [1, 2]}
          onConnect={isPreviewMode ? undefined : handleConnect}
          onNodesChange={isPreviewMode ? undefined : handleNodesChange}
          onEdgesChange={isPreviewMode ? undefined : handleEdgesChange}
          onNodeDoubleClick={isPreviewMode ? undefined : handleNodeDoubleClick}
          onPaneClick={isPreviewMode ? undefined : handlePaneClick}
          snapToGrid
          snapGrid={[16, 16]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={2} />
          <Controls />
          <MiniMap />
        </ReactFlow>

        {/* Preview mode banner */}
        {isPreviewMode && previewEntry && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-6 py-3 rounded-full bg-zinc-800/95 border border-zinc-600 shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-medium text-zinc-200">
              Preview: {previewEntry.description}
            </span>
            <span className="text-xs text-zinc-400">
              {previewEntry.nodes.length} nodes · {previewEntry.edges.length} edges
            </span>
          </div>
        )}

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
          onPreviewHistory={handlePreviewHistory}
          className="absolute top-4 right-4 z-10"
        />

        {hasManuellTrigger && !isPreviewMode ? (
          <Button
            type="button"
            onClick={handleExecuteWorkflow}
            disabled={execution.running}
            className="absolute top-4 left-1/2 z-10 -translate-x-1/2 inline-flex h-11 items-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-inset ring-white/10 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            size="lg"
          >
            {execution.running ? (
              <IconLoader2 className="size-4 animate-spin" stroke={2.5} aria-hidden />
            ) : (
              <IconBolt className="size-4" stroke={2} aria-hidden />
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
        // Only show results from upstream nodes (nodes that can flow into this one).
        // Traverse backwards through edges to find all ancestors.
        allNodeResults={(() => {
          if (!inspectorNode) return undefined

          // Find all upstream node IDs by traversing backwards
          const upstreamIds = new Set<string>()
          const queue = [inspectorNode.id]
          while (queue.length > 0) {
            const currentId = queue.shift()!
            const incomingEdges = edges.filter((e) => e.target === currentId)
            for (const edge of incomingEdges) {
              if (!upstreamIds.has(edge.source)) {
                upstreamIds.add(edge.source)
                queue.push(edge.source)
              }
            }
          }

          // Build results from upstream nodes only
          const results: Record<string, unknown> = {}
          for (const node of nodes) {
            if (!upstreamIds.has(node.id)) continue
            const result = execution.results[node.id]
            if (result !== undefined) {
              const label = node.data.label || node.id
              results[label] = result
            }
          }
          return Object.keys(results).length > 0 ? results : undefined
        })()}
        // Upstream nodes and edges for the mini canvas
        upstreamGraph={(() => {
          if (!inspectorNode) return undefined

          // Find all upstream node IDs by traversing backwards
          const upstreamIds = new Set<string>()
          const queue = [inspectorNode.id]
          while (queue.length > 0) {
            const currentId = queue.shift()!
            const incomingEdges = edges.filter((e) => e.target === currentId)
            for (const edge of incomingEdges) {
              if (!upstreamIds.has(edge.source)) {
                upstreamIds.add(edge.source)
                queue.push(edge.source)
              }
            }
          }

          // Get upstream nodes and edges
          const upstreamNodes = nodes.filter((n) => upstreamIds.has(n.id))
          const upstreamEdges = edges.filter(
            (e) => upstreamIds.has(e.source) && upstreamIds.has(e.target)
          )

          return upstreamNodes.length > 0
            ? { nodes: upstreamNodes, edges: upstreamEdges }
            : undefined
        })()}
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
