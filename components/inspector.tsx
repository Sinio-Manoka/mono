"use client"

import { useState, type ChangeEvent } from "react"
import { IconTrash, IconX } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
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
          "p-0 before:rounded-none before:inset-0 before:border-0 before:shadow-none"
        )}
      >
        {/* Top bar — title block anchored to the drawer's top-left corner,
            action buttons to the top-right. Both float above the body. */}
        <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-2">
          <div>
            <DrawerTitle>
              {nodeType === "trigger" ? "Trigger" : "Request"}
            </DrawerTitle>
            <DrawerDescription className="font-mono">
              {nodeId}
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

        <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 pb-8 pt-20">
          <Field
            label="Label"
            value={(localData.label as string | undefined) ?? ""}
            onChange={(value) => apply({ label: value })}
          />
          <Field
            label="Subtitle"
            value={(localData.subtitle as string | undefined) ?? ""}
            onChange={(value) => apply({ subtitle: value })}
          />

          {nodeType === "request" ? (
            <>
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
            </>
          ) : null}
        </div>
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
