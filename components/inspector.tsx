"use client"

import { useState, useMemo, useRef, useCallback, type ChangeEvent } from "react"
import {
  IconBolt,
  IconChevronLeft,
  IconTrash,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import { resolvePath } from "@/lib/expression-path"
import { NodeLabel } from "@/components/nodes/node-label"
import { AuthEditor } from "@/components/auth-editor"
import { BodyEditor } from "@/components/body-editor"
import { InputDataEditor } from "@/components/input-data-editor"
import { KeyValueEditor } from "@/components/key-value-editor"
import { JsonViewer } from "@/components/json-viewer"
import type {
  NodeData,
  NodeType,
  RequestNodeData,
  TriggerNodeData,
} from "@/components/nodes/types"

type UpstreamGraph = {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

type InspectorProps = {
  /** When provided, the drawer is open and bound to this node. */
  nodeId: string | null
  nodeType: NodeType | null
  data: NodeData
  /** All node results from the workflow execution, keyed by node label. */
  allNodeResults?: Record<string, unknown>
  /** Upstream nodes and edges for the mini canvas. */
  upstreamGraph?: UpstreamGraph
  /** Result of the last successful execution of this node (if any). */
  nodeResult?: unknown
  /** Error message from the last failed execution of this node (if any). */
  nodeError?: string
  /** True while the workflow execution engine is running. */
  isRunning?: boolean
  onChange: (patch: Partial<NodeData>) => void
  onDelete: () => void
  onOpenChange: (open: boolean) => void
}

const METHOD_OPTIONS = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "DELETE", label: "DELETE" },
  { value: "PATCH", label: "PATCH" },
] as const

// Get all available paths from nested data
function getAllPaths(obj: unknown, prefix: string): string[] {
  const paths: string[] = [prefix]
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj)) {
      paths.push(...getAllPaths(val, `${prefix}.${key}`))
    }
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      paths.push(...getAllPaths(item, `${prefix}[${idx}]`))
    })
  }
  return paths
}

export function Inspector({
  nodeId,
  nodeType,
  data,
  allNodeResults,
  upstreamGraph,
  nodeResult,
  nodeError,
  isRunning,
  onChange,
  onDelete,
  onOpenChange,
}: InspectorProps) {
  // Local mirror of the whole data object so typing doesn't fight the
  // parent's controlled state on every keystroke. The parent passes
  // `key={nodeId}` so the component remounts when the selection changes,
  // which keeps this state fresh without a syncing effect.
  const [localData, setLocalData] = useState<NodeData>(data)

  // Track which node is selected in the mini canvas to show its data
  const [selectedMiniNode, setSelectedMiniNode] = useState<string | null>(null)

  // When non-null, the left column swaps the mini canvas for a panel
  // showing that node's draggable fields and output. Cleared by the
  // panel's back/close buttons.
  const [dataPanelNodeId, setDataPanelNodeId] = useState<string | null>(null)

  // Find node ID by label and select it in the mini canvas
  const selectNodeByLabel = useCallback(
    (nodeLabel: string) => {
      if (!upstreamGraph) return
      const node = upstreamGraph.nodes.find(
        (n) => (n.data.label || n.id) === nodeLabel
      )
      if (node) {
        setSelectedMiniNode(node.id)
      }
    },
    [upstreamGraph]
  )

  // Open the data panel for the node that was double-clicked in the
  // mini canvas. Switching nodes mid-panel replaces the open node
  // (no-op effectively, since `dataPanelNodeId` is just overwritten).
  const handleMiniNodeDoubleClick = useCallback((nodeId: string) => {
    setDataPanelNodeId(nodeId)
  }, [])

  const closeDataPanel = useCallback(() => {
    setDataPanelNodeId(null)
  }, [])

  // `Partial<NodeData>` is the union of the per-type partials, so a patch
  // built for either side is assignable. We use a single function instead
  // of a generic `updateField<K>` because `keyof (A | B)` is the
  // intersection of keys, which would reject type-specific fields.
  const apply = (patch: Partial<NodeData>) => {
    setLocalData((prev) => ({ ...prev, ...patch }))
    onChange(patch)
  }

  // Compute the log content up front so the copy-to-clipboard button
  // knows whether there's anything to copy and so the click handler
  // doesn't need to re-derive the string.
  const logBody: string | null = isRunning
    ? "This node is currently being executed."
    : nodeError
    ? nodeError
    : nodeResult !== undefined
    ? typeof nodeResult === "string"
      ? nodeResult
      : JSON.stringify(nodeResult, null, 2)
    : null

  // State for the "Expand" popup that shows the full log without any
  // truncation. The header's expand button toggles this.
  const [logExpanded, setLogExpanded] = useState(false)

  return (
    <Drawer
      open={nodeId !== null}
      onOpenChange={onOpenChange}
      direction="bottom"
      modal={false}
    >
      <DrawerContent
        className={cn(
          "p-0 before:rounded-none before:inset-0 before:border-0 before:shadow-none",
          "max-h-[95vh]!"
        )}
      >
        {/* Top bar — title block anchored to the drawer's top-left corner,
            action buttons to the top-right. Both float above the body.
            The title is the node's name, inline-editable in place via
            <NodeLabel> (the same component used to live on the node
            card). The description below it is the node type — replacing
            the id that used to live here. */}
        <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-2">
          <div>
            <DrawerTitle>
              <NodeLabel
                value={(localData.label as string | undefined) ?? ""}
                onChange={(value) => apply({ label: value })}
                // `text-base` overrides the NodeLabel default `text-sm`
                // so the title sits at the same size the surrounding
                // DrawerTitle typography expects.
                className="text-base"
              />
            </DrawerTitle>
            <DrawerDescription className="font-mono">
              {nodeType ?? "unknown"}
            </DrawerDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              aria-label="Delete block"
              onClick={onDelete}
            >
              <IconTrash />
            </Button>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close inspector"
              >
                <IconX />
              </Button>
            </DrawerClose>
          </div>
        </div>

        <div className="relative mx-auto grid w-full grid-cols-1 gap-6 px-4 pb-8 pt-20 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          {/* Left column: mini canvas showing upstream nodes */}
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2 h-[400px] overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Available Data
              </h3>
            </div>

            {upstreamGraph && upstreamGraph.nodes.length > 0 ? (
              <div className="flex-1 rounded-md border border-border overflow-hidden">
                {dataPanelNodeId ? (
                  <DataPanel
                    nodeId={dataPanelNodeId}
                    nodes={upstreamGraph.nodes}
                    allNodeResults={allNodeResults ?? {}}
                    onClose={closeDataPanel}
                  />
                ) : (
                  <MiniCanvas
                    nodes={upstreamGraph.nodes}
                    edges={upstreamGraph.edges}
                    selectedNodeId={selectedMiniNode}
                    onNodeClick={(nodeId) => setSelectedMiniNode(nodeId)}
                    onNodeDoubleClick={handleMiniNodeDoubleClick}
                    allNodeResults={allNodeResults}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground overflow-y-auto">
                No upstream data. Connect nodes and run the workflow.
              </div>
            )}
          </div>

          {/* Center: the editable form. The grid's `auto` middle column
              sizes to the form's content (max-w-sm on mobile, w-80 on
              lg), and the equal 1fr columns on either side push it to
              the page center. */}
          <div className="mx-auto w-full max-w-2xl overflow-y-auto lg:w-96">
            {nodeType === "request" ? (
              <div className="flex flex-col gap-4">
                <SelectField
                  label="Method"
                  value={
                    (localData as RequestNodeData).method ?? "GET"
                  }
                  options={METHOD_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  onChange={(value) => apply({ method: value })}
                />
                <Field
                  label="URL"
                  value={(localData as RequestNodeData).url ?? ""}
                  onChange={(value) => apply({ url: value })}
                  placeholder="https://api.example.com"
                  availableData={allNodeResults}
                  onExpressionClick={selectNodeByLabel}
                />
                <KeyValueEditor
                  label="Query Parameters"
                  description="Add key-value pairs for query parameters"
                  value={(localData as RequestNodeData).queryParams ?? ""}
                  onChange={(value) => apply({ queryParams: value })}
                />
                <KeyValueEditor
                  label="Headers"
                  description="Configure custom headers for the request"
                  value={(localData as RequestNodeData).headers ?? ""}
                  onChange={(value) => apply({ headers: value })}
                />
                <AuthEditor
                  value={(localData as RequestNodeData).authToken ?? ""}
                  onChange={(value) => apply({ authToken: value })}
                />
                <BodyEditor
                  value={(localData as RequestNodeData).body ?? ""}
                  onChange={(value) => apply({ body: value })}
                />
              </div>
            ) : nodeType === "trigger" ? (
              <div className="flex flex-col gap-4">
                <InputDataEditor
                  value={(localData as TriggerNodeData).inputData ?? ""}
                  onChange={(value) => apply({ inputData: value })}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This node type has no editable fields. Edit the name in the
                header above.
              </p>
            )}
          </div>

          {/* Right column: the log panel. With `1fr` on lg it fills the
              space from the right of the form to the drawer's right
              edge. `min-w-0` lets the inner <pre> shrink and wrap long
              lines instead of forcing the grid track to grow. */}
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2 h-[400px] overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Log
              </h3>
            </div>

            {isRunning ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-blue-500/40 bg-blue-500/5 px-3 py-6 text-center text-xs text-blue-700 dark:text-blue-300 overflow-y-auto">
                <span>This node is currently being executed...</span>
              </div>
            ) : nodeError ? (
              <div className="flex-1 rounded-md overflow-y-auto">
                <JsonViewer data={nodeError} title="Error" />
              </div>
            ) : nodeResult !== undefined ? (
              <div className="flex-1 rounded-md overflow-y-auto">
                <JsonViewer data={nodeResult} title="Result" />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground overflow-y-auto">
                No execution log yet. Click{" "}
                <span className="font-medium">Execute Workflow</span> to
                run this node.
              </div>
            )}
          </div>
        </div>

        {/* Full-log popup. Toggled by the Expand button in the log
            header. Renders the entire text body (no truncation) in a
            monospace <pre> that scrolls inside the dialog. */}
        <Dialog open={logExpanded} onOpenChange={setLogExpanded}>
          <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col">
            <DialogHeader>
              <DialogTitle>Full log</DialogTitle>
              <DialogDescription>
                {logBody
                  ? `${logBody.split("\n").length} line${
                      logBody.split("\n").length === 1 ? "" : "s"
                    } · ${logBody.length} characters`
                  : "No log content"}
              </DialogDescription>
            </DialogHeader>
            <pre className="mt-2 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
              {logBody}
            </pre>
          </DialogContent>
        </Dialog>
      </DrawerContent>
    </Drawer>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  availableData,
  onExpressionClick,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  availableData?: Record<string, unknown>
  onExpressionClick?: (nodeLabel: string) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteFilter, setAutocompleteFilter] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allPaths = useMemo(() => {
    if (!availableData) return []
    const paths: string[] = []
    for (const [nodeLabel, data] of Object.entries(availableData)) {
      paths.push(...getAllPaths(data, nodeLabel))
    }
    return paths
  }, [availableData])

  const filteredPaths = allPaths.filter((p) =>
    p.toLowerCase().includes(autocompleteFilter.toLowerCase())
  )

  // Check if a full expression path exists in the data. Uses the same
  // `resolvePath` helper the executor uses so the in-editor highlight
  // agrees with what the engine will actually resolve at run time —
  // expressions that survive this check will work; ones that don't will
  // be left as literal text and the request will fail.
  const isValidPath = (expr: string): boolean => {
    if (!availableData) return false
    const path = expr.replace(/^\{\{|\}\}$/g, "").trim()
    const firstDot = path.search(/[.[]/)
    if (firstDot === -1) {
      return path in availableData
    }

    const nodeLabel = path.slice(0, firstDot)
    if (!(nodeLabel in availableData)) return false

    const rest = path.slice(firstDot + (path[firstDot] === "." ? 1 : 0))
    return resolvePath(availableData[nodeLabel], rest) !== undefined
  }

  const handleDrop = (e: React.DragEvent<HTMLInputElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const expr = e.dataTransfer.getData("application/x-expression") ||
                 e.dataTransfer.getData("text/plain")
    if (expr) {
      const input = e.currentTarget
      const start = input.selectionStart ?? value.length
      const end = input.selectionEnd ?? value.length
      const newValue = value.slice(0, start) + expr + value.slice(end)
      onChange(newValue)
      setTimeout(() => {
        input.setSelectionRange(start + expr.length, start + expr.length)
        input.focus()
      }, 0)
    }
  }

  // Parse expressions and render highlighted text (only for valid paths)
  const renderHighlightedValue = () => {
    if (!value) return null
    const parts: React.ReactNode[] = []
    const regex = /(\{\{[^}]+\}\})/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {value.slice(lastIndex, match.index)}
          </span>
        )
      }
      // Check if the expression references a valid path
      const expr = match[1]
      const nodeLabel = expr.replace(/^\{\{|\}\}$/g, "").split(".")[0]
      const isValid = isValidPath(expr)

      if (isValid) {
        // Valid expression — emerald highlight signals "this will resolve
        // at run time". Clickable so the user can jump to the source node
        // in the mini canvas.
        parts.push(
          <span
            key={`expr-${match.index}`}
            onClick={(e) => {
              e.stopPropagation()
              onExpressionClick?.(nodeLabel)
            }}
            className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded px-0.5 cursor-pointer hover:bg-emerald-500/30 transition-colors"
            title={`Resolvable: ${expr}`}
          >
            {expr}
          </span>
        )
      } else {
        // Invalid expression — red + strikethrough signals "won't resolve
        // at run time, this URL will fail". Tooltip explains why.
        parts.push(
          <span
            key={`expr-${match.index}`}
            className="bg-red-500/15 text-red-700 dark:text-red-300 line-through rounded px-0.5"
            title={`Cannot resolve ${expr} — no upstream node with that data yet`}
          >
            {expr}
          </span>
        )
      }
      lastIndex = match.index + match[0].length
    }
    // Add remaining text
    if (lastIndex < value.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {value.slice(lastIndex)}
        </span>
      )
    }
    return parts
  }

  // Only consider it as having valid expressions if at least one path is valid
  const hasValidExpressions = (() => {
    const regex = /(\{\{[^}]+\}\})/g
    let match
    while ((match = regex.exec(value)) !== null) {
      if (isValidPath(match[1])) return true
    }
    return false
  })()

  // Handle input change and detect {{ for autocomplete
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const pos = e.target.selectionStart ?? 0
    onChange(newValue)
    setCursorPosition(pos)

    // Check if we just typed {{ or are in the middle of an expression
    const textBeforeCursor = newValue.slice(0, pos)
    const lastOpenBrace = textBeforeCursor.lastIndexOf("{{")
    const lastCloseBrace = textBeforeCursor.lastIndexOf("}}")

    if (lastOpenBrace > lastCloseBrace) {
      // We're inside an expression
      const filterText = textBeforeCursor.slice(lastOpenBrace + 2)
      setAutocompleteFilter(filterText)
      setShowAutocomplete(true)
    } else {
      setShowAutocomplete(false)
      setAutocompleteFilter("")
    }
  }

  // Insert selected autocomplete path
  const insertPath = (path: string) => {
    const textBeforeCursor = value.slice(0, cursorPosition)
    const textAfterCursor = value.slice(cursorPosition)
    const lastOpenBrace = textBeforeCursor.lastIndexOf("{{")

    const newValue =
      textBeforeCursor.slice(0, lastOpenBrace) +
      `{{${path}}}` +
      textAfterCursor

    onChange(newValue)
    setShowAutocomplete(false)
    setAutocompleteFilter("")

    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = lastOpenBrace + path.length + 4
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            // Delay hiding autocomplete so clicks can register
            setTimeout(() => setShowAutocomplete(false), 150)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          placeholder={placeholder}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
            "text-foreground placeholder:text-muted-foreground",
            "outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
            isDragOver && "border-primary ring-2 ring-primary/30 bg-primary/5",
            hasValidExpressions && !isFocused && "text-transparent caret-foreground"
          )}
        />

        {/* Autocomplete dropdown */}
        {showAutocomplete && filteredPaths.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
            {filteredPaths.slice(0, 20).map((path) => (
              <button
                key={path}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertPath(path)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
              >
                <code className="text-xs text-orange-600 dark:text-orange-400">
                  {`{{${path}}}`}
                </code>
              </button>
            ))}
          </div>
        )}

        {/* Overlay for highlighted expressions - only show when not focused */}
        {hasValidExpressions && !isFocused && (
          <div
            className="absolute inset-0 flex items-center px-3 text-sm pointer-events-none"
            aria-hidden
          >
            <span className="truncate pointer-events-auto">
              {renderHighlightedValue()}
            </span>
          </div>
        )}
      </div>
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
          "text-foreground outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// Mini canvas theme style (same as main canvas but smaller)
const miniCanvasStyle = {
  "--xy-background-color": "var(--muted)",
  "--xy-background-pattern-color": "var(--border)",
  "--xy-edge-stroke": "var(--muted-foreground)",
  "--xy-edge-stroke-selected": "var(--primary)",
  "--xy-handle-background-color": "var(--muted-foreground)",
  "--xy-handle-border-color": "var(--background)",
} as React.CSSProperties

// Mini node for trigger type (simple, no inline fields)
function MiniTriggerNode({
  data,
  selected,
}: NodeProps<Node<NodeData>>) {
  return (
    <div
      className={cn(
        "grid h-8 w-8 cursor-pointer place-items-center rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      <IconBolt className="size-3 text-amber-500 dark:text-amber-400" />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}

// Mini node for request type (simple, no inline fields)
function MiniRequestNode({
  data,
  selected,
}: NodeProps<Node<NodeData>>) {
  const label = data.label || "Request"

  return (
    <div
      className={cn(
        "min-w-24 cursor-pointer rounded-lg border bg-card px-2 py-1.5 text-card-foreground shadow-sm transition-shadow",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-1">
        <IconWorld className="size-3 shrink-0 text-sky-500 dark:text-sky-400" />
        <div className="min-w-0 flex-1 truncate text-xs font-medium">
          {label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}

const miniNodeTypes = {
  trigger: MiniTriggerNode,
  request: MiniRequestNode,
}

function MiniCanvas({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  onNodeDoubleClick,
  allNodeResults,
}: {
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  onNodeClick?: (nodeId: string) => void
  onNodeDoubleClick?: (nodeId: string, nodeLabel: string) => void
  allNodeResults?: Record<string, unknown>
}) {
  // Mark nodes as selected
  const nodesWithSelection = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    [nodes, selectedNodeId]
  )

  // React Flow swallows the synthetic `dblclick` event when the canvas is
  // configured with `nodesDraggable={false}` + `elementsSelectable={false}` +
  // `panOnDrag={true}` — the pointer-down for the first click is claimed
  // for pan and never produces a `dblclick` on the node. We DO get a
  // reliable `onNodeClick` (the wrapper's `onSelectNodeHandler` calls it
  // regardless), so detect double-clicks here by tracking per-node click
  // timestamps and treating a second click within 300ms as a double-click.
  const lastClickAtRef = useRef<Map<string, number>>(new Map())

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      const now = Date.now()
      const prev = lastClickAtRef.current.get(node.id)
      lastClickAtRef.current.set(node.id, now)

      if (prev !== undefined && now - prev < 300) {
        // Second click within window → double-click. Clear the entry so
        // a third click doesn't re-fire it.
        lastClickAtRef.current.delete(node.id)
        const label = (node.data as NodeData).label || node.id
        onNodeDoubleClick?.(node.id, label)
        return
      }

      onNodeClick?.(node.id)
    },
    [onNodeClick, onNodeDoubleClick]
  )

  return (
    <ReactFlowProvider>
      <div className="h-full w-full" style={miniCanvasStyle}>
        <ReactFlow
          nodes={nodesWithSelection}
          edges={edges}
          nodeTypes={miniNodeTypes}
          onNodeClick={handleNodeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={12} size={1} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}

/**
 * Read-only view of one upstream node's output, with each leaf path
 * exposed as a draggable field. Shown in the left column when the user
 * double-clicks a node in the mini canvas — replaces the canvas until
 * they press back / close.
 *
 * Result resolution: prefers the runtime result from `allNodeResults`
 * (populated by the execution engine). For trigger nodes that haven't
 * been executed yet, falls back to the configured `inputData` so the
 * user can still drag fields into a downstream URL while authoring.
 */
function DataPanel({
  nodeId,
  nodes,
  allNodeResults,
  onClose,
}: {
  nodeId: string
  nodes: Node<NodeData>[]
  allNodeResults: Record<string, unknown>
  onClose: () => void
}) {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null

  const label = (node.data.label as string | undefined) || node.id

  // Prefer the runtime result; fall back to the configured input data for
  // triggers that haven't been executed yet so the user can still drag
  // fields into a downstream URL while authoring the workflow.
  let result: unknown = allNodeResults[label]
  if (result === undefined && node.type === "trigger") {
    const inputData = (node.data as TriggerNodeData).inputData
    if (inputData?.trim()) {
      try {
        const inputConfig = JSON.parse(inputData)
        switch (inputConfig.type) {
          case "json":
            if (inputConfig.json) {
              try {
                result = JSON.parse(inputConfig.json)
              } catch {
                result = inputConfig.json
              }
            }
            break
          case "form":
            if (Array.isArray(inputConfig.form)) {
              result = Object.fromEntries(
                inputConfig.form.map(
                  (f: { key: string; value: string }) => [f.key, f.value]
                )
              )
            }
            break
          case "text":
            result = inputConfig.text || ""
            break
        }
      } catch {
        // inputData isn't valid JSON — leave result undefined
      }
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header: back to canvas on the left, close on the right. Both call
          `onClose` because the panel is the only thing the user can return
          from — there's no separate "back to canvas" state to distinguish. */}
      <div className="flex items-center justify-between gap-1 border-b border-border bg-muted/30 px-1.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Back to canvas"
            title="Back to canvas"
          >
            <IconChevronLeft className="size-4" />
          </Button>
          <span className="truncate text-sm font-medium" title={label}>
            {label}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <IconX className="size-4" />
        </Button>
      </div>

      {/* JSON viewer fills the rest of the panel. `nodeLabel` is what turns
          each value into a draggable cell — the viewer wraps each value in
          a `<span draggable>` that copies `{{Label.path}}` into the URL
          input on drop. The tree already has syntax highlighting for keys,
          strings, numbers, booleans, null. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        {result !== undefined ? (
          <JsonViewer data={result} title={label} nodeLabel={label} />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-2 py-3 text-center text-xs text-muted-foreground">
            No data yet. Run the workflow to populate this node's output.
          </div>
        )}
      </div>
    </div>
  )
}