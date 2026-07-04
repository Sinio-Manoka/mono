import Link from "next/link"

import { formatRelative } from "@/lib/format-relative"
import type { WorkflowSummary } from "@/lib/workflows"
import { WorkflowCard } from "@/components/workflow-card"

export function WorkflowGrid({ summaries }: { summaries: WorkflowSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((summary) => (
        <Link
          key={summary.id}
          href={`/${summary.id}/workflow`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-xl"
        >
          <WorkflowCard
            summary={summary}
            relativeTime={formatRelative(summary.updatedAt)}
          />
        </Link>
      ))}
    </div>
  )
}