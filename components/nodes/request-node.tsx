"use client"

import { IconWorld } from "@tabler/icons-react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { cn } from "@/lib/utils"
import type { RequestNodeData } from "@/components/nodes/types"

export function RequestNode({
  data,
  selected,
}: NodeProps<Node<RequestNodeData>>) {
  const { label = "Request", method = "GET", url } = data
  return (
    <div
      className={cn(
        "min-w-40 cursor-pointer rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow",
        selected
          ? "border-ring shadow-md ring-2 ring-ring/30"
          : "border-border"
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
          className="size-3.5 text-sky-500 dark:text-sky-400"
          aria-hidden
        />
        <div className="text-sm font-medium">{label}</div>
      </div>
      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
        {method}
        {url ? ` ${url}` : ""}
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
