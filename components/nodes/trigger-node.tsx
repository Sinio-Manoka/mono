"use client"

import { IconBolt } from "@tabler/icons-react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { cn } from "@/lib/utils"
import type { NodeExecutionStatus } from "@/lib/execution-status"
import type { TriggerNodeData } from "@/components/nodes/types"

export function TriggerNode(
  props: NodeProps<Node<TriggerNodeData>> & {
    onUpdate: (patch: Partial<TriggerNodeData>) => void
    executionStatus?: NodeExecutionStatus
  }
) {
  const { data, selected, executionStatus = "idle" } = props
  void data
  void props.onUpdate
  return (
    <div
      className={cn(
        "grid h-10 w-10 cursor-pointer place-items-center rounded-lg border bg-card shadow-sm transition-shadow",
        // Selection ring (when idle and selected).
        selected && executionStatus === "idle"
          ? "border-ring shadow-md ring-2 ring-ring/30"
          : "border-border",
        // Execution rings override the selection ring so the user can see
        // which node ran / is running / failed at a glance.
        executionStatus === "running" &&
          "border-blue-500 ring-2 ring-blue-500/50 animate-pulse",
        executionStatus === "success" &&
          "border-emerald-500 ring-2 ring-emerald-500/40",
        executionStatus === "error" &&
          "border-red-500 ring-2 ring-red-500/40"
      )}
    >
      {/* No target handle — triggers are entry points; nothing can connect INTO a trigger. */}
      <IconBolt
        className="size-4 text-amber-500 dark:text-amber-400"
        aria-label="Trigger node"
      />
      <Handle
        type="source"
        position={Position.Right}
        aria-label="output"
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
      />
    </div>
  )
}
