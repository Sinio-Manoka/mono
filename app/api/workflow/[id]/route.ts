import { promises as fs } from "fs"
import path from "path"

import { NextResponse } from "next/server"

import type { Edge, Node } from "@xyflow/react"

import type { NodeData } from "@/components/nodes/types"

// File-backed workflow storage, one file per workflow id under
// `data/<id>.json`. The `data/` directory is git-ignored so each
// environment can have its own saved state. For production with multiple
// replicas you'd swap this for a database — the route shape (`GET`
// returns the snapshot, `POST` replaces it) is the only contract the
// client depends on.

const DATA_DIR = path.join(process.cwd(), "data")

type WorkflowSnapshot = {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

function workflowPath(id: string): string {
  // Keep the path confined to the data dir — the id is URL-supplied so a
  // crafted value like `../../etc/passwd` could otherwise escape it.
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_") || "default"
  return path.join(DATA_DIR, `${safe}.json`)
}

async function readWorkflow(id: string): Promise<WorkflowSnapshot | null> {
  try {
    const raw = await fs.readFile(workflowPath(id), "utf-8")
    const parsed = JSON.parse(raw) as Partial<WorkflowSnapshot>
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null
    }
    return parsed as WorkflowSnapshot
  } catch {
    // ENOENT (no file yet) or JSON parse error — both are "no saved workflow".
    return null
  }
}

async function writeWorkflow(
  id: string,
  snapshot: WorkflowSnapshot
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    workflowPath(id),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const snapshot = await readWorkflow(id)
  if (!snapshot) {
    // No saved workflow yet — return an empty shape. The client decides
    // whether to seed defaults from this.
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

  await writeWorkflow(id, {
    nodes: parsed.nodes as Node<NodeData>[],
    edges: parsed.edges as Edge[],
  })

  return NextResponse.json({ ok: true })
}