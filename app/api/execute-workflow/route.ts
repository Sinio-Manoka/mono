import { NextRequest, NextResponse } from "next/server"
import type { Edge, Node } from "@xyflow/react"
import type { NodeData } from "@/components/nodes/types"
import { executeWorkflow } from "@/lib/execute-workflow"

export async function POST(request: NextRequest) {
  try {
    const { nodes, edges, startId } = (await request.json()) as {
      nodes: Node<NodeData>[]
      edges: Edge[]
      startId: string
    }

    // Create a ReadableStream that yields execution steps
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const step of executeWorkflow(nodes, edges, startId)) {
            // Send each step as a JSON line
            controller.enqueue(
              JSON.stringify(step) + "\n"
            )
          }
          controller.close()
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          controller.enqueue(
            JSON.stringify({ type: "error", error }) + "\n"
          )
          controller.close()
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error }, { status: 400 })
  }
}
