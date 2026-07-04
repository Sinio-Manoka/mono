import { formatRelative } from "@/lib/format-relative"
import type { WorkflowSummary } from "@/lib/workflows"
import { WorkflowCard } from "@/components/workflow-card"

export function WorkflowGrid({ summaries }: { summaries: WorkflowSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((summary) => (
        <WorkflowCard
          key={summary.id}
          summary={summary}
          relativeTime={formatRelative(summary.updatedAt)}
        />
      ))}
    </div>
  )
}