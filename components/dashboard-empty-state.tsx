import { IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { CreateWorkflowDialog } from "@/components/create-workflow-dialog"

export function DashboardEmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No workflows yet</h2>
        <p className="text-sm text-muted-foreground">
          Create your first workflow to get started. It lives on disk so it
          survives browser refreshes and switches.
        </p>
      </div>
      <CreateWorkflowDialog>
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <IconPlus className="size-4" stroke={2.5} aria-hidden />
          Create your first workflow
        </Button>
      </CreateWorkflowDialog>
    </div>
  )
}
