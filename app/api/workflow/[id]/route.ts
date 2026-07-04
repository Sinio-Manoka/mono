import { NextResponse } from "next/server"

import type { Edge, Node } from "@xyflow/react"

import type { NodeData } from "@/components/nodes/types"
import {
  deleteWorkflow,
  getWorkflow,
  renameWorkflow,
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
    name:
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim()
        : undefined,
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
  const deleted = await deleteWorkflow(id)
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

export async function PATCH(
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

  const name =
    body && typeof body === "object" && typeof (body as { name?: unknown }).name === "string"
      ? (body as { name: string }).name
      : ""

  const trimmed = name.trim()
  if (!trimmed) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    )
  }

  try {
    const result = await renameWorkflow(id, trimmed)
    return NextResponse.json(result)
  } catch (err) {
    const code = (err as Error & { code?: string }).code
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    throw err
  }
}