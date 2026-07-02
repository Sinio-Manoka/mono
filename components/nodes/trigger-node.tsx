"use client"

import { IconBolt } from "@tabler/icons-react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { cn } from "@/lib/utils"
import type { TriggerNodeData } from "@/components/nodes/types"

export function TriggerNode({
  data,
  selected,
}: NodeProps<Node<TriggerNodeData>>) {
  const { label = "Trigger", triggerType = "manual" } = data
  return (
    <div
      className={cn(
        "min-w-40 cursor-pointer rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow",
        selected
          ? "border-ring shadow-md ring-2 ring-ring/30"
          : "border-border"
      )}
    >
      {/* No target handle — triggers are entry points; nothing can connect INTO a trigger. */}
      <div className="flex items-center gap-1.5">
        <IconBolt
          className="size-3.5 text-amber-500 dark:text-amber-400"
          aria-hidden
        />
        <div className="text-sm font-medium">{label}</div>
      </div>
      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
        {triggerType === "manual" ? "manual" : "on request"}
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
