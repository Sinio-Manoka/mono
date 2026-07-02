"use client"

import { IconBolt } from "@tabler/icons-react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { cn } from "@/lib/utils"
import type { TriggerNodeData } from "@/components/nodes/types"

export function TriggerNode(
  props: NodeProps<Node<TriggerNodeData>> & {
    onUpdate: (patch: Partial<TriggerNodeData>) => void
  }
) {
  const { data, selected } = props
  // The card is intentionally minimal — the node's name lives in the
  // Inspector header now, not on the card itself. The icon alone is
  // enough to distinguish a trigger (lightning) from a request (globe)
  // when scanning the canvas.
  void data
  void props.onUpdate
  return (
    <div
      className={cn(
        "grid h-10 w-10 cursor-pointer place-items-center rounded-lg border bg-card shadow-sm transition-shadow",
        selected
          ? "border-ring shadow-md ring-2 ring-ring/30"
          : "border-border"
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
