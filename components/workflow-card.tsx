"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { IconTrash } from "@tabler/icons-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkflowSummary } from "@/lib/workflows"

export function WorkflowCard({
  summary,
  relativeTime,
}: {
  summary: WorkflowSummary
  relativeTime: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/workflow/${summary.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed")
      setDeleting(false)
    }
  }

  function open() {
    router.push(`/${summary.id}/workflow`)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      open()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      aria-label={`Open workflow ${summary.name}`}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="space-y-1">
        <EditableName
          id={summary.id}
          name={summary.name}
          // Don't let name-click bubble up and open the editor.
          onClick={(e) => e.stopPropagation()}
        />
        <div className="font-mono text-xs text-muted-foreground">
          {summary.id}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {summary.nodeCount} {summary.nodeCount === 1 ? "node" : "nodes"} ·{" "}
        {relativeTime}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete workflow ${summary.name}`}
            className="absolute right-2 top-2 size-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => e.stopPropagation()}
            disabled={deleting}
          >
            <IconTrash className="size-4" aria-hidden />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{summary.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the workflow file from{" "}
              <code className="font-mono text-xs">data/{summary.id}.json</code>.
              You can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * The workflow display name on a dashboard card, editable inline.
 *
 * Click → switches to a text input. Blur or Enter saves via PATCH and
 * triggers a router refresh so the card reflects the new value (and
 * the file's mtime, which moves the card in the sorted list).
 * Escape cancels and reverts to the previous name.
 */
function EditableName({
  id,
  name,
  onClick,
}: {
  id: string
  name: string
  onClick: (e: React.MouseEvent) => void
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // If the upstream name changes (e.g. after router.refresh re-renders
  // us with a new value), keep the local input value in sync.
  useEffect(() => {
    if (!editing) setValue(name)
  }, [name, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) {
      // No change or empty — just close.
      setValue(name)
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/workflow/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setValue(trimmed)
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed")
      // Keep the input open so the user can retry or escape.
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValue(name)
    setError(null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === "Escape") {
              e.preventDefault()
              cancel()
            }
          }}
          disabled={saving}
          aria-label="Workflow name"
          className={cn(
            "w-full rounded-md border border-input bg-background px-2 py-1 text-base font-semibold",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            saving && "opacity-60"
          )}
        />
        {error ? (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      // Click to start editing — the parent card's onClick would otherwise
      // navigate to the editor.
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      title="Click to rename"
      className="-mx-1 cursor-text rounded px-1 text-base font-semibold hover:bg-muted/50"
    >
      {value}
    </div>
  )
}