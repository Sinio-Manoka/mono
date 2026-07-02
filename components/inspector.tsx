"use client"

import { useState, type ChangeEvent } from "react"
import {
  IconArrowsMaximize,
  IconCheck,
  IconCopy,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

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
import { NodeLabel } from "@/components/nodes/node-label"
import type {
  NodeData,
  NodeType,
  RequestNodeData,
} from "@/components/nodes/types"

type InspectorProps = {
  /** When provided, the drawer is open and bound to this node. */
  nodeId: string | null
  nodeType: NodeType | null
  data: NodeData
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

export function Inspector({
  nodeId,
  nodeType,
  data,
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
  const hasLogContent = logBody !== null

  // Tiny "copied!" feedback state for the clipboard button.
  const [copied, setCopied] = useState(false)
  const handleCopyLog = async () => {
    if (!logBody) return
    try {
      await navigator.clipboard.writeText(logBody)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("[inspector] clipboard write failed", err)
    }
  }

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
          // Full-bleed sheet: drop the shadcn default's `p-4` padding, the
          // `before:rounded-4xl` rounded card, the `before:inset-2` 8px
          // gutter, the `before:border` outline, and the `before:shadow-xl`
          // drop shadow. The drawer now spans the viewport edge-to-edge with
          // sharp corners and no internal padding.
          "p-0 before:rounded-none before:inset-0 before:border-0 before:shadow-none",
          // The shadcn DrawerContent caps the bottom drawer at 80vh. Bump
          // that to 90vh via `!` so the form + log + header all fit
          // comfortably without the drawer feeling cramped.
          "max-h-[90vh]!"
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

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 pb-8 pt-20 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          {/* Left spacer — 1fr column, only rendered on lg so the form
              is centered. On mobile the form spans the full column. */}
          <div className="hidden lg:block" aria-hidden />

          {/* Center: the editable form. The grid's `auto` middle column
              sizes to the form's content (max-w-sm on mobile, w-80 on
              lg), and the equal 1fr columns on either side push it to
              the page center. */}
          <div className="mx-auto w-full max-w-sm lg:w-80">
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
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Log
              </h3>
              {hasLogContent ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy log to clipboard"
                    onClick={handleCopyLog}
                  >
                    {copied ? (
                      <IconCheck className="size-4" />
                    ) : (
                      <IconCopy className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Expand log in popup"
                    onClick={() => setLogExpanded(true)}
                  >
                    <IconArrowsMaximize className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>

            {isRunning ? (
              <ExecutionLog
                title="Running…"
                tone="info"
                body="This node is currently being executed."
              />
            ) : nodeError ? (
              <ExecutionLog title="Error" tone="error" body={nodeError} />
            ) : nodeResult !== undefined ? (
              <ExecutionLog
                title="Last result"
                tone="success"
                body={nodeResult}
              />
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
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
          <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col">
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
            <pre className="mt-2 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
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
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
          "text-foreground placeholder:text-muted-foreground",
          "outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        )}
      />
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

function ExecutionLog({
  title,
  tone,
  body,
}: {
  title: string
  tone: "info" | "success" | "error"
  body: unknown
}) {
  const toneClasses: Record<typeof tone, string> = {
    info: "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300",
    success:
      "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    error: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
  }
  const text =
    typeof body === "string" ? body : JSON.stringify(body, null, 2)
  // Long logs get a soft cap (max-h-72 = 18rem) with internal scrolling
  // and a trailing "…" so the user can tell there's more below the fold
  // without us truncating the content. The full body is always available
  // via the header's Expand button.
  const PREVIEW_LINES = 20
  const lines = text.split("\n")
  const isLong = lines.length > PREVIEW_LINES
  const preview = isLong
    ? lines.slice(0, PREVIEW_LINES).join("\n") + "\n…"
    : text

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        toneClasses[tone]
      )}
    >
      <div className="font-medium">{title}</div>
      <pre
        className={cn(
          "mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-all",
          "rounded-sm bg-background/40 p-2 font-mono text-[11px] leading-relaxed"
        )}
      >
        {preview}
      </pre>
    </div>
  )
}
