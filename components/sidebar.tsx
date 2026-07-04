"use client"

import { useState } from "react"
import {
  IconCheck,
  IconDeviceFloppy,
  IconDownload,
  IconLoader2,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NodeData, NodeType } from "@/components/nodes/types"
import { CreateNodeDialog } from "@/components/create-node-dialog"
import { HistoryPanel, type HistoryEntry } from "@/components/history-panel"

type SaveState = "idle" | "saving" | "saved"

type SidebarProps = {
  onAddNode: (type: NodeType, initialData?: Partial<NodeData>) => void
  onSave: () => void
  onDownload: () => void
  onLoad: () => void
  saveState: SaveState
  hasChanges: boolean
  disabledKeys?: ReadonlySet<string>
  history?: HistoryEntry[]
  historyIndex?: number
  onRestoreHistory?: (index: number) => void
  onDeleteHistory?: (index: number) => void
  onDownloadHistory?: (entry: HistoryEntry, index: number) => void
  onPreviewHistory?: (entry: HistoryEntry | null) => void
  className?: string
}

export function Sidebar({
  onAddNode,
  onSave,
  onDownload,
  onLoad,
  saveState,
  hasChanges,
  disabledKeys,
  history = [],
  historyIndex = -1,
  onRestoreHistory,
  onDeleteHistory,
  onDownloadHistory,
  onPreviewHistory,
  className,
}: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  return (
    // `items-start` keeps the icon-pill buttons at their natural width instead
    // of stretching to fill the column (the flex-col default of `items-stretch`
    // would make every button a full-width pill even when collapsed).
    // `w-36` fixes the sidebar width so it doesn't grow when a single button
    // expands on hover. Without this, the canvas positions the sidebar with
    // `absolute right-4`, so the right edge is pinned and the sidebar grows
    // LEFTWARD to fit the expanded button — taking the left-aligned buttons
    // with it. A fixed width keeps every button's position stable across
    // hover states.
    <div className={cn("flex flex-col items-start gap-2 w-36", className)}>
      <ActionButton
        groupName="add-node"
        icon={<IconPlus className="size-5" stroke={2.5} aria-hidden />}
        label="Add Node"
        onClick={() => {
          setOpen(true)
          setResetKey((k) => k + 1)
        }}
        tone="primary"
      />
      <SaveButton
        groupName="save"
        state={saveState}
        hasChanges={hasChanges}
        onClick={onSave}
      />
      <ActionButton
        groupName="download"
        icon={<IconDownload className="size-5" stroke={2.5} aria-hidden />}
        label="Download"
        onClick={onDownload}
        tone="muted"
      />
      <ActionButton
        groupName="load"
        icon={<IconUpload className="size-5" stroke={2.5} aria-hidden />}
        label="Load"
        onClick={onLoad}
        tone="muted"
      />

      {history.length > 0 && onRestoreHistory && onDeleteHistory && onDownloadHistory && onPreviewHistory && (
        <HistoryPanel
          history={history}
          currentIndex={historyIndex}
          onRestore={onRestoreHistory}
          onDelete={onDeleteHistory}
          onDownload={onDownloadHistory}
          onPreview={onPreviewHistory}
        />
      )}

      <CreateNodeDialog
        key={resetKey}
        open={open}
        onOpenChange={setOpen}
        onAddNode={onAddNode}
        disabledKeys={disabledKeys}
      />
    </div>
  )
}

type ButtonTone = "primary" | "emerald" | "muted"

/**
 * Unique named-group classes for each button. The label inside a button
 * can only react to its OWN group's hover/focus — not the sibling's —
 * because each group name is unique to one button.
 *
 * The `group/button` class that shadcn's `buttonVariants` adds is NOT
 * used here (it would be shared between both buttons, which is exactly
 * the bug we hit before). Instead, each ActionButton gets its own
 * `group/<name>` and its label uses `group-hover/<name>:` /
 * `group-focus-visible/<name>:` to target that specific group.
 */
type GroupName = "add-node" | "save" | "download" | "load"

function groupClasses(name: GroupName) {
  switch (name) {
    case "add-node":
      return {
        group: "group/add-node",
        buttonHover:
          "group-hover/add-node:gap-2 group-hover/add-node:shadow-xl group-focus-visible/add-node:gap-2 group-focus-visible/add-node:shadow-xl",
        labelHover:
          "group-hover/add-node:max-w-xs group-hover/add-node:opacity-100 group-focus-visible/add-node:max-w-xs group-focus-visible/add-node:opacity-100",
      }
    case "save":
      return {
        group: "group/save",
        buttonHover:
          "group-hover/save:gap-2 group-hover/save:shadow-xl group-focus-visible/save:gap-2 group-focus-visible/save:shadow-xl",
        labelHover:
          "group-hover/save:max-w-xs group-hover/save:opacity-100 group-focus-visible/save:max-w-xs group-focus-visible/save:opacity-100",
      }
    case "download":
      return {
        group: "group/download",
        buttonHover:
          "group-hover/download:gap-2 group-hover/download:shadow-xl group-focus-visible/download:gap-2 group-focus-visible/download:shadow-xl",
        labelHover:
          "group-hover/download:max-w-xs group-hover/download:opacity-100 group-focus-visible/download:max-w-xs group-focus-visible/download:opacity-100",
      }
    case "load":
      return {
        group: "group/load",
        buttonHover:
          "group-hover/load:gap-2 group-hover/load:shadow-xl group-focus-visible/load:gap-2 group-focus-visible/load:shadow-xl",
        labelHover:
          "group-hover/load:max-w-xs group-hover/load:opacity-100 group-focus-visible/load:max-w-xs group-focus-visible/load:opacity-100",
      }
  }
}

function ActionButton({
  icon,
  label,
  onClick,
  tone,
  disabled = false,
  groupName,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone: ButtonTone
  disabled?: boolean
  groupName: GroupName
}) {
  const toneClasses: Record<ButtonTone, string> = {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40",
    emerald:
      "bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-500/40",
    muted:
      "bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:ring-ring/40",
  }

  const groups = groupClasses(groupName)

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        // Each button gets its own `group/<name>` so its label can only
        // react to THIS button's hover/focus — not the sibling's.
        groups.group,
        // Resting state: icon-only pill. The hover/focus utilities under
        // `groups.buttonHover` open it up to make room for the label.
        // `justify-start` (not center) pins the icon to the left padding so
        // every button's icon stays vertically aligned regardless of which
        // sibling is currently expanded — center would make the expanded
        // button's icon drift right and the other icons look like they
        // shifted left.
        "inline-flex h-12 items-center justify-start gap-0 rounded-full px-3.5 shadow-lg",
        "transition-all duration-200 ease-out",
        groups.buttonHover,
        "focus-visible:ring-3 focus-visible:outline-none",
        "active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-70",
        toneClasses[tone]
      )}
    >
      {icon}
      <span
        className={cn(
          // Resting state: collapsed. `groups.labelHover` expands it when
          // the SAME button (not the sibling) is hovered/focused.
          "max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0",
          "transition-[max-width,opacity] duration-200 ease-out",
          groups.labelHover
        )}
      >
        {label}
      </span>
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function SaveButton({
  state,
  hasChanges,
  onClick,
  groupName,
}: {
  state: SaveState
  hasChanges: boolean
  onClick: () => void
  groupName: GroupName
}) {
  const isSaving = state === "saving"
  const justSaved = state === "saved"

  const label = isSaving
    ? "Saving…"
    : justSaved
    ? "Saved!"
    : hasChanges
    ? "Save"
    : "Saved"

  const icon = isSaving ? (
    <IconLoader2 className="size-5 animate-spin" aria-hidden />
  ) : justSaved ? (
    <IconCheck className="size-5" aria-hidden />
  ) : hasChanges ? (
    <IconDeviceFloppy className="size-5" aria-hidden />
  ) : (
    <IconCheck className="size-5" aria-hidden />
  )

  const tone: ButtonTone = isSaving || justSaved || hasChanges
    ? "emerald"
    : "muted"

  return (
    <ActionButton
      groupName={groupName}
      icon={icon}
      label={label}
      onClick={onClick}
      tone={tone}
      disabled={isSaving}
    />
  )
}