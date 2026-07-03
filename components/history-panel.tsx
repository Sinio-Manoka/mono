"use client"

import { useState, useEffect, useCallback } from "react"
import { IconHistory, IconX, IconDownload, IconTrash } from "@tabler/icons-react"
import { ReactFlow, ReactFlowProvider, useReactFlow, type Node, type Edge } from "@xyflow/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NodeData } from "@/components/nodes/types"

export type HistoryEntry = {
  nodes: Node<NodeData>[]
  edges: Edge[]
  timestamp: number
  description: string
}

type HistoryPanelProps = {
  history: HistoryEntry[]
  currentIndex: number
  onRestore: (index: number) => void
  onDelete: (index: number) => void
  onDownload: (entry: HistoryEntry, index: number) => void
  className?: string
}

export function HistoryPanel({
  history,
  currentIndex,
  onRestore,
  onDelete,
  onDownload,
  className,
}: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  // Update current time every minute for relative time display
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  const recentHistory = history.slice(-20).reverse()

  const formatTime = useCallback((timestamp: number) => {
    const diff = currentTime - timestamp
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(timestamp).toLocaleTimeString()
  }, [currentTime])

  if (!isOpen) {
    return (
      <Button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="History"
        className={cn(
          "group/history",
          "inline-flex h-12 items-center justify-center gap-0 rounded-full px-3.5 shadow-lg",
          "transition-all duration-200 ease-out",
          "group-hover/history:gap-2 group-hover/history:pl-3 group-hover/history:pr-4 group-hover/history:shadow-xl",
          "focus-visible:ring-3 focus-visible:outline-none focus-visible:ring-ring/40",
          "active:translate-y-px",
          "bg-muted text-muted-foreground hover:bg-muted/80",
          className
        )}
      >
        <IconHistory className="size-5" stroke={2.5} aria-hidden />
        <span
          className={cn(
            "max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0",
            "transition-[max-width,opacity] duration-200 ease-out",
            "group-hover/history:max-w-xs group-hover/history:opacity-100"
          )}
        >
          History ({history.length})
        </span>
      </Button>
    )
  }

  return (
    <div
      className={cn(
        "w-80 rounded-xl border bg-card shadow-2xl overflow-hidden",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <IconHistory className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Version History</span>
          <span className="text-xs text-muted-foreground">
            ({recentHistory.length})
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0"
        >
          <IconX className="size-4" />
        </Button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {recentHistory.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No versions yet
          </div>
        ) : (
          <div className="divide-y">
            {recentHistory.map((entry, idx) => {
              const actualIndex = history.length - 1 - idx
              const isCurrent = actualIndex === currentIndex

              return (
                <div
                  key={entry.timestamp}
                  className={cn(
                    "relative px-4 py-3 transition-colors",
                    isCurrent ? "bg-primary/10" : "hover:bg-muted/50"
                  )}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate flex-1">
                      {entry.description}
                    </span>
                    {isCurrent && (
                      <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatTime(entry.timestamp)}</span>
                    <span>•</span>
                    <span>{entry.nodes.length} nodes</span>
                    <span>•</span>
                    <span>{entry.edges.length} edges</span>
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRestore(actualIndex)
                        setIsOpen(false)
                      }}
                      className="h-7 text-xs flex-1"
                      disabled={isCurrent}
                    >
                      Restore
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDownload(entry, actualIndex)
                      }}
                      className="h-7 w-7 p-0"
                      title="Download JSON"
                    >
                      <IconDownload className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(actualIndex)
                      }}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="Delete version"
                      disabled={history.length <= 1}
                    >
                      <IconTrash className="size-3.5" />
                    </Button>
                  </div>

                  {hoveredIndex === idx && (
                    <div
                      className="absolute right-full top-0 mr-2 w-72 h-48 rounded-lg border bg-background shadow-xl overflow-hidden z-50"
                      style={{ pointerEvents: "none" }}
                    >
                      <ReactFlowProvider>
                        <MiniWorkflowPreview
                          nodes={entry.nodes}
                          edges={entry.edges}
                        />
                      </ReactFlowProvider>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniWorkflowPreview({
  nodes,
  edges,
}: {
  nodes: Node<NodeData>[]
  edges: Edge[]
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.3, duration: 0 })
    }, 50)
    return () => clearTimeout(timer)
  }, [fitView, nodes, edges])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      className="bg-muted/30"
    />
  )
}
