import { NextResponse } from "next/server"

import {
  WorkflowExistsError,
  createWorkflow,
  listWorkflows,
} from "@/lib/workflows"

export async function GET() {
  const summaries = await listWorkflows()
  return NextResponse.json(summaries)
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
    const { id } = await createWorkflow(trimmed)
    return NextResponse.json({ id })
  } catch (err) {
    if (err instanceof WorkflowExistsError) {
      return NextResponse.json(
        { error: "Workflow already exists" },
        { status: 409 }
      )
    }
    throw err
  }
}
