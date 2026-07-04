import { IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { listWorkflows } from "@/lib/workflows"
import { CreateWorkflowDialog } from "@/components/create-workflow-dialog"
import { DashboardEmptyState } from "@/components/dashboard-empty-state"
import { WorkflowGrid } from "@/components/workflow-grid"

export async function Dashboard() {
  const summaries = await listWorkflows()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Saved on disk under <code className="font-mono text-xs">data/</code>.
          </p>
        </div>
        <CreateWorkflowDialog>
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <IconPlus className="size-4" stroke={2.5} aria-hidden />
            New workflow
          </Button>
        </CreateWorkflowDialog>
      </header>

      {summaries.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <WorkflowGrid summaries={summaries} />
      )}
    </main>
  )
}
