import { promises as fs } from "fs"
import path from "path"

import { NextResponse } from "next/server"

import type { Edge, Node } from "@xyflow/react"

import type { NodeData } from "@/components/nodes/types"

// File-backed workflow storage. `data/workflow.json` lives at the project
// root; the `data/` directory is git-ignored so each environment can have
// its own saved state. For production with multiple replicas you'd swap
// this for a database — the route shape (`GET` returns the snapshot,
// `POST` replaces it) is the only contract the client depends on.

const DATA_DIR = path.join(process.cwd(), "data")
const WORKFLOW_FILE = path.join(DATA_DIR, "workflow.json")

type WorkflowSnapshot = {
  nodes: Node<NodeData>[]
  edges: Edge[]
}

async function readWorkflow(): Promise<WorkflowSnapshot | null> {
  try {
    const raw = await fs.readFile(WORKFLOW_FILE, "utf-8")
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

async function writeWorkflow(snapshot: WorkflowSnapshot): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    WORKFLOW_FILE,
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  )
}

export async function GET() {
  const snapshot = await readWorkflow()
  if (!snapshot) {
    // No saved workflow yet — return an empty shape. The client decides
    // whether to seed defaults from this.
    return NextResponse.json(
      { nodes: [], edges: [] } satisfies WorkflowSnapshot
    )
  }
  return NextResponse.json(snapshot)
}

export async function POST(request: Request) {
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

  await writeWorkflow({
    nodes: parsed.nodes as Node<NodeData>[],
    edges: parsed.edges as Edge[],
  })

  return NextResponse.json({ ok: true })
}
