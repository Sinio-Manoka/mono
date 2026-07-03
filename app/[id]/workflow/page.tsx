import { Canvas } from "@/components/canvas"

/**
 * The main workflow editor. Lives at `/[id]/workflow` so the URL carries
 * a workflow identifier — useful once the storage layer is split per-workflow
 * (right now the single `data/workflow.json` is still shared, this is a URL-
 * structure pivot only).
 *
 * `params` is a Promise in Next.js 15+ — await it before reading.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <Canvas workflowId={id} />
}