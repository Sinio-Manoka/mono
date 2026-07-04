import { promises as fs } from "fs"
import path from "path"

import type { Edge, Node } from "@xyflow/react"

import type { NodeData } from "@/components/nodes/types"

// The single seam for all workflow persistence. Server-only — every
// function below uses `node:fs` and reads/writes files under `DATA_DIR`.
// Both route handlers and server components import from here so the
// filesystem (or future database) can be swapped without touching callers.
//
// `data/` is git-ignored (see .gitignore) so each environment keeps its
// own saved state.

const DATA_DIR = path.join(process.cwd(), "data")

export type WorkflowSnapshot = {
  name?: string
  nodes: Node<NodeData>[]
  edges: Edge[]
}

export type WorkflowSummary = {
  id: string
  name: string
  nodeCount: number
  updatedAt: string
}

export class WorkflowExistsError extends Error {
  readonly id: string
  constructor(id: string) {
    super(`Workflow already exists: ${id}`)
    this.name = "WorkflowExistsError"
    this.id = id
  }
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_") || "default"
}

function snapshotPath(id: string): string {
  return path.join(DATA_DIR, `${sanitizeId(id)}.json`)
}

function isWorkflowSnapshot(value: unknown): value is WorkflowSnapshot {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.nodes) && Array.isArray(v.edges)
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(DATA_DIR)
  } catch (err) {
    // ENOENT (data dir not yet created) — treat as empty.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
    throw err
  }

  const summaries: WorkflowSummary[] = []
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue
    const id = entry.slice(0, -".json".length)
    try {
      const [raw, stat] = await Promise.all([
        fs.readFile(path.join(DATA_DIR, entry), "utf-8"),
        fs.stat(path.join(DATA_DIR, entry)),
      ])
      const parsed: unknown = JSON.parse(raw)
      if (!isWorkflowSnapshot(parsed)) {
        console.warn(`[workflows] skipping ${entry}: not a valid snapshot`)
        continue
      }
      summaries.push({
        id,
        name: parsed.name?.trim() || id,
        nodeCount: parsed.nodes.length,
        updatedAt: stat.mtime.toISOString(),
      })
    } catch (err) {
      console.warn(`[workflows] skipping ${entry}:`, err)
    }
  }

  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return summaries
}

export async function getWorkflow(id: string): Promise<WorkflowSnapshot | null> {
  try {
    const raw = await fs.readFile(snapshotPath(id), "utf-8")
    const parsed: unknown = JSON.parse(raw)
    if (!isWorkflowSnapshot(parsed)) return null
    return parsed
  } catch {
    // ENOENT, parse error, or any other fs/JSON failure — treat as "no saved workflow"
    return null
  }
}

export async function saveWorkflow(
  id: string,
  snapshot: WorkflowSnapshot
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    snapshotPath(id),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  )
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  try {
    await fs.unlink(snapshotPath(id))
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false
    throw err
  }
}

export async function createWorkflow(
  name: string
): Promise<{ id: string }> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error("Name is required")
  }
  const id = sanitizeId(trimmed)
  try {
    await fs.access(snapshotPath(id))
    throw new WorkflowExistsError(id)
  } catch (err) {
    if (err instanceof WorkflowExistsError) throw err
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
  await saveWorkflow(id, { name: trimmed, nodes: [], edges: [] })
  return { id }
}
