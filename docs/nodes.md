# Adding a node type

The cleanest way to think about a "node type" is four pieces:

1. **Data shape** — what fields the node stores.
2. **Catalog entry** — the picker, dedup, and form metadata.
3. **Renderer** — how the node looks on the canvas.
4. **Executor** — what happens when the workflow reaches this node.

Each piece lives in a different file, but the catalog entry is the
one that drives everything else — once it's there, the picker,
form, and Inspector pick it up automatically.

## Walkthrough: a "Delay" node

A simple example: a node that waits N milliseconds before letting
the graph continue.

### 1. Data shape

Add to `components/nodes/types.ts`:

```ts
export type DelayNodeData = {
  label?: string
  /** How many milliseconds to wait. */
  ms?: string  // string so the user can type {{expr}} values
}
```

And extend the union:

```ts
export type NodeData = TriggerNodeData | RequestNodeData | DelayNodeData

export type NodeType = "trigger" | "request" | "delay"

export function isNodeType(value: string | undefined): value is NodeType {
  return (
    value === "trigger" ||
    value === "request" ||
    value === "delay"
  )
}
```

### 2. Catalog entry

In the same file, append to `NODE_CATALOG`:

```ts
import { IconClock } from "@tabler/icons-react"

{
  key: "delay",
  type: "delay",
  label: "Delay",
  description: "Wartet N Millisekunden, bevor es weitergeht.",
  icon: IconClock,
  fields: [
    { key: "label", label: "Label", type: "text", defaultValue: "Delay" },
    {
      key: "ms",
      label: "Milliseconds",
      type: "text",
      placeholder: "1000",
      defaultValue: "1000",
    },
  ],
},
```

The picker will now show "Delay" and the create-form will render
the two fields above. The Inspector (which is driven by the same
catalog) will show the same fields when a Delay node is selected.

### 3. Renderer

Create `components/nodes/delay-node.tsx`:

```tsx
"use client"

import { IconClock } from "@tabler/icons-react"
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react"

import { cn } from "@/lib/utils"
import type { NodeExecutionStatus } from "@/lib/execution-status"
import type { DelayNodeData } from "@/components/nodes/types"

export function DelayNode(
  props: NodeProps<Node<DelayNodeData>> & {
    onUpdate: (patch: Partial<DelayNodeData>) => void
    executionStatus?: NodeExecutionStatus
  }
) {
  const { data, selected, executionStatus = "idle" } = props
  const { label = "Delay", ms = "1000" } = data
  return (
    <div
      className={cn(
        "min-w-32 rounded-lg border bg-card p-3 text-card-foreground shadow-sm",
        selected ? "border-ring ring-2 ring-ring/30" : "border-border",
        executionStatus === "running" && "border-blue-500 animate-pulse",
        executionStatus === "success" && "border-emerald-500",
        executionStatus === "error" && "border-red-500",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label="input"
        className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-center gap-1.5">
        <IconClock className="size-3.5 text-violet-500" aria-hidden />
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="ml-auto text-xs text-muted-foreground">{ms}ms</div>
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
```

Register it in `components/canvas.tsx` — find `nodeTypesFor(...)` and
add:

```ts
import { DelayNode } from "@/components/nodes/delay-node"
// ...
const nodeTypesFor = (...) => ({
  trigger: ...,
  request: ...,
  delay: (props: NodeProps) => {
    const typed = props as NodeProps<Node<DelayNodeData>>
    return (
      <DelayNode
        {...typed}
        onUpdate={(patch) => updateNodeData(typed.id, patch)}
        executionStatus={getStatus(typed.id)}
      />
    )
  },
})
```

### 4. Executor

In `lib/execute-workflow.ts`, add an entry to the `executors` map:

```ts
import type {
  DelayNodeData,
  NodeData,
  RequestNodeData,
  TriggerNodeData,
} from "@/components/nodes/types"
// ...
const executors: Record<string, NodeExecutor> = {
  // ...existing...
  delay: async (node, input, nodeResults) => {
    const data = resolveNodeData(node.data as DelayNodeData, nodeResults)
    // Resolve {{...}} expressions in the ms field
    const ms = Number(data.ms ?? "0")
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`Invalid delay: ${data.ms}`)
    }
    await new Promise((resolve) => setTimeout(resolve, ms))
    // Pass through — downstream nodes see the previous input.
    return input
  },
}
```

The executor receives the previous node's result as `input`. The
Delay node is a passthrough — it returns `input` unchanged so
downstream nodes see the same envelope as before.

## Test it

1. `npm run dev`
2. Open `/default/workflow`.
3. Add a Delay node. Wire it between the trigger and the request.
4. Save. Run. The request should fire after the configured delay,
   and the node rings should briefly turn blue → green.

## Optional: `UNIQUE_CATALOG_KEYS`

If your node type should be limited to one per workflow (e.g.
"the manual trigger"), add its catalog key to
`UNIQUE_CATALOG_KEYS` in `components/nodes/types.ts`. The Canvas
will grey out / disable the picker entry when one is already on
the canvas.

## Optional: custom inspector editor

The Inspector renders form fields generically based on each
`NodeField`'s `type` (`text` or `select`). For richer inputs
(JSON, key-value pairs, form-data, etc.) add a new editor
component in `components/<name>-editor.tsx`, then teach the
Inspector to use it for the relevant field. The pattern is
already in place for `body`, `headers`, `auth`, `inputData`, etc.
— copy one of them and adjust.
