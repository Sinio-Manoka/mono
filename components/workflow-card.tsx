"use client"

import { useState } from "react"
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
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
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
      setError(err instanceof Error ? err.message : "Delete failed")
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
      className="relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="space-y-1">
        <div className="text-base font-semibold">{summary.name}</div>
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
            // Keep the click here from triggering the card's navigation.
            // Without this the user sees the dialog flash then get bounced
            // to the editor — because the card's onClick runs even though
            // we never asked it to navigate.
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
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
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