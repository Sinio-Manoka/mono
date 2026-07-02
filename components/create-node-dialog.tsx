"use client"

import { useState, type ChangeEvent } from "react"
import { IconChevronLeft } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  NODE_CATALOG,
  type NodeData,
  type NodeDefinition,
  type NodeField,
  type NodeType,
} from "@/components/nodes/types"

type CreateNodeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddNode: (type: NodeType, initialData?: Partial<NodeData>) => void
  /** Catalog keys that should be hidden from the picker (e.g. because a
   *  one-of-a-kind node already exists on the canvas). */
  disabledKeys?: ReadonlySet<string>
}

const TYPE_LABELS: Record<NodeType, string> = {
  trigger: "Triggers",
  request: "Actions",
}

export function CreateNodeDialog({
  open,
  onOpenChange,
  onAddNode,
  disabledKeys,
}: CreateNodeDialogProps) {
  // `null` → picker list. A `NodeDefinition` → inline config form for that
  // node. The parent (Sidebar) passes a `key` that bumps each time the
  // dialog opens, so this state always starts fresh — no `useEffect` reset
  // needed (which the `react-hooks/set-state-in-effect` rule would flag).
  const [selectedDef, setSelectedDef] = useState<NodeDefinition | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  const availableEntries = NODE_CATALOG.filter(
    (e) => !disabledKeys?.has(e.key)
  )

  const handlePick = (def: NodeDefinition) => {
    setSelectedDef(def)
    const values: Record<string, string> = {}
    for (const field of def.fields) {
      values[field.key] = field.defaultValue ?? ""
    }
    setFieldValues(values)
  }

  const handleSubmit = () => {
    if (!selectedDef) return
    const data: Record<string, string> = {}
    for (const [key, value] of Object.entries(fieldValues)) {
      if (value !== "" && value != null) data[key] = value
    }
    onAddNode(selectedDef.type, data as Partial<NodeData>)
    onOpenChange(false)
  }

  const Icon = selectedDef?.icon

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          selectedDef
            ? `Configure ${selectedDef.label}…`
            : "Search nodes…"
        }
        autoFocus
      />
      <CommandList>
        <CommandEmpty>No nodes found.</CommandEmpty>
        {selectedDef == null
          ? (["trigger", "request"] as const).map((group) => {
              const entries = availableEntries.filter(
                (e) => e.type === group
              )
              if (entries.length === 0) return null
              return (
                <CommandGroup key={group} heading={TYPE_LABELS[group]}>
                  {entries.map((entry) => {
                    const EntryIcon = entry.icon
                    return (
                      <CommandItem
                        key={entry.key}
                        value={entry.label}
                        onSelect={() => handlePick(entry)}
                      >
                        <EntryIcon className="size-4 text-muted-foreground" />
                        <span>{entry.label}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {entry.description}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })
          : null}
      </CommandList>

      {selectedDef ? (
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            {Icon ? (
              <span
                aria-hidden
                className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary"
              >
                <Icon className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {selectedDef.label}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selectedDef.description}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {selectedDef.fields.map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={fieldValues[field.key] ?? ""}
                onChange={(value) =>
                  setFieldValues((prev) => ({ ...prev, [field.key]: value }))
                }
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDef(null)}
            >
              <IconChevronLeft className="size-4" />
              Back
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit}>
              Add Node
            </Button>
          </div>
        </div>
      ) : null}
    </CommandDialog>
  )
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: NodeField
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {field.label}
      </span>
      {field.type === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
            "text-foreground outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          )}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          value={value}
          placeholder={field.placeholder}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
        />
      )}
    </label>
  )
}
