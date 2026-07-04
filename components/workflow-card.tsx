import type { WorkflowSummary } from "@/lib/workflows"

export function WorkflowCard({ summary }: { summary: WorkflowSummary }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <div className="text-base font-semibold">{summary.name}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {summary.id}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {summary.nodeCount} {summary.nodeCount === 1 ? "node" : "nodes"} ·{" "}
        {summary.updatedAt}
      </div>
    </div>
  )
}
