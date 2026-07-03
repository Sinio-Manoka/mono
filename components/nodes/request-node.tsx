"use client"

import { IconWorld } from "@tabler/icons-react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { cn } from "@/lib/utils"
import type { NodeExecutionStatus } from "@/lib/execution-status"
import type { RequestNodeData } from "@/components/nodes/types"

export function RequestNode(
  props: NodeProps<Node<RequestNodeData>> & {
    onUpdate: (patch: Partial<RequestNodeData>) => void
    executionStatus?: NodeExecutionStatus
  }
) {
  const { data, selected, executionStatus = "idle" } = props
  void props.onUpdate
  const { label = "Request" } = data
  return (
    <div
      className={cn(
        "min-w-40 cursor-pointer rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow",
        selected && executionStatus === "idle"
          ? "border-ring shadow-md ring-2 ring-ring/30"
          : "border-border",
        executionStatus === "running" &&
          "border-blue-500 ring-2 ring-blue-500/50 animate-pulse",
        executionStatus === "success" &&
          "border-emerald-500 ring-2 ring-emerald-500/40",
        executionStatus === "error" &&
          "border-red-500 ring-2 ring-red-500/40"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label="input"
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-1.5">
        <IconWorld
          className="size-3.5 shrink-0 text-sky-500 dark:text-sky-400"
          aria-hidden
        />
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        aria-label="output"
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}
