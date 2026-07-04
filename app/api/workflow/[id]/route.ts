import { NextResponse } from "next/server"

import type { Edge, Node } from "@xyflow/react"

import type { NodeData } from "@/components/nodes/types"
import {
  deleteWorkflow,
  getWorkflow,
  saveWorkflow,
  type WorkflowSnapshot,
} from "@/lib/workflows"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const snapshot = await getWorkflow(id)
  if (!snapshot) {
    return NextResponse.json(
      { nodes: [], edges: [] } satisfies WorkflowSnapshot
    )
  }
  return NextResponse.json(snapshot)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const parsed = body as Partial<WorkflowSnapshot> | null
  if (
    !parsed ||
    !Array.isArray(parsed.nodes) ||
    !Array.isArray(parsed.edges)
  ) {
    return NextResponse.json(
      { error: "Body must be { nodes: Node[]; edges: Edge[] }" },
      { status: 400 }
    )
  }

  await saveWorkflow(id, {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    nodes: parsed.nodes as Node<NodeData>[],
    edges: parsed.edges as Edge[],
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await deleteWorkflow(id)
  return NextResponse.json({ ok: true })
}