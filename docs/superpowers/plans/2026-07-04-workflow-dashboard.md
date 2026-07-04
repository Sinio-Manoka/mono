# Workflow Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/` with a dashboard that lists, opens, creates, and deletes workflows stored on disk under `data/<id>.json`, and lets the editor save a per-workflow display name.

**Architecture:** A new server-only `lib/workflows.ts` becomes the single seam for all filesystem operations. Existing and new route handlers thin-wrap it. The dashboard page is a server component that reads summaries via the lib; interactivity lives in small client islands (cards, dialog). Editor gains a name input that rides on the existing save flow.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui primitives (`Card`, `Input`, `Button`, `Dialog`, `AlertDialog`), `@tabler/icons-react`, `node:fs` / `node:path`.

**Spec:** [docs/superpowers/specs/2026-07-04-workflow-dashboard-design.md](../specs/2026-07-04-workflow-dashboard-design.md)

## Global Constraints

These apply to every task. Spec-derived rules are quoted verbatim.

- **No test runner wired up.** `package.json` has no `test` script. Verification uses `npm run typecheck`, `npm run lint`, and `npm run build`. Manual smoke at the end.
- **TypeScript strict.** Imports use the `@/...` alias. No relative imports.
- **Prettier config (per CLAUDE.md):** no semicolons, double quotes, `trailingComma: "es5"`, `printWidth: 80`. `prettier-plugin-tailwindcss` sorts Tailwind classes.
- **Module type is ESM** (`"type": "module"` in `package.json`).
- **Client components** must start with `"use client"`. `app/layout.tsx`, `app/page.tsx`, and `app/[id]/workflow/page.tsx` are server components.
- **`data/` is git-ignored.** Never commit files under `data/`.
- **Sanitization rule (quoted from spec):** `sanitizeId(raw)` = `raw.replace(/[^a-zA-Z0-9_-]/g, "_") || "default"`. Preserves case. Spaces and special characters become `_`.
- **Snapshot schema (quoted from spec):** `WorkflowSnapshot = { name?: string; nodes: Node<NodeData>[]; edges: Edge[] }`. The `name` field is optional; UI falls back to id when absent.
- **Dark mode is keyed off `[data-theme="dark"]`** (set by `next-themes`), not `.dark`. The standard `dark:` variant does not work here.

## File Structure

### Created
- `lib/workflows.ts` — types + fs ops + `WorkflowExistsError`
- `app/api/workflows/route.ts` — `GET` list, `POST` create
- `components/dashboard.tsx` — server, top-level dashboard layout
- `components/workflow-grid.tsx` — server, grid of cards
- `components/workflow-card.tsx` — client, card with delete
- `components/create-workflow-dialog.tsx` — client, name input modal
- `components/dashboard-empty-state.tsx` — server, empty-state CTA

### Modified
- `app/page.tsx` — replace redirect with `<Dashboard />`
- `app/api/workflow/[id]/route.ts` — refactor to use `lib/workflows.ts`; add `DELETE`
- `components/sidebar.tsx` — add workflow-name `<Input>` at top
- `components/canvas.tsx` — track `workflowName` state; include in save body

---

## Task 1: Add `lib/workflows.ts` — storage seam

**Files:**
- Create: `lib/workflows.ts`

**Interfaces:**
- Consumes: `node:fs/promises`, `node:path`, `Node<NodeData>` and `Edge` from `@xyflow/react`, `NodeData` from `@/components/nodes/types`
- Produces:
  - `export type WorkflowSnapshot = { name?: string; nodes: Node<NodeData>[]; edges: Edge[] }`
  - `export type WorkflowSummary = { id: string; name: string; nodeCount: number; updatedAt: string }`
  - `export class WorkflowExistsError extends Error { readonly id: string }`
  - `export function sanitizeId(raw: string): string`
  - `export async function listWorkflows(): Promise<WorkflowSummary[]>`
  - `export async function getWorkflow(id: string): Promise<WorkflowSnapshot | null>`
  - `export async function saveWorkflow(id: string, snapshot: WorkflowSnapshot): Promise<void>`
  - `export async function deleteWorkflow(id: string): Promise<void>`
  - `export async function createWorkflow(name: string): Promise<{ id: string }>`

- [ ] **Step 1: Create the file**

Create `lib/workflows.ts` with the following content (verbatim — copy exactly):

```ts
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
        name: parsed.name ?? id,
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
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
    throw err
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

export async function deleteWorkflow(id: string): Promise<void> {
  try {
    await fs.unlink(snapshotPath(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0 with no output (TS strict, all signatures align with existing imports).

- [ ] **Step 3: Commit**

```bash
git add lib/workflows.ts
git commit -m "feat(workflows): add storage seam lib/workflows.ts"
```

---

## Task 2: Refactor `app/api/workflow/[id]/route.ts` and add DELETE

**Files:**
- Modify: `app/api/workflow/[id]/route.ts` (full rewrite — the local `DATA_DIR`, sanitizer, and `readWorkflow`/`writeWorkflow` are replaced by imports from the new lib)

**Interfaces:**
- Consumes: `getWorkflow`, `saveWorkflow`, `deleteWorkflow`, `WorkflowSnapshot` from `@/lib/workflows`
- Produces: same route contract as before for `GET` and `POST`; new `DELETE` returns `{ ok: true }` (or 404 if the file is already gone — but `deleteWorkflow` swallows ENOENT, so we always return `{ ok: true }`)

- [ ] **Step 1: Replace the file contents**

Overwrite `app/api/workflow/[id]/route.ts` with:

```ts
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds; route table includes `ƒ /api/workflow/[id]`.

- [ ] **Step 4: Commit**

```bash
git add app/api/workflow/[id]/route.ts
git commit -m "refactor(api): route workflow [id] through lib; add DELETE"
```

---

## Task 3: Add `app/api/workflows/route.ts`

**Files:**
- Create: `app/api/workflows/route.ts`

**Interfaces:**
- Consumes: `listWorkflows`, `createWorkflow`, `WorkflowExistsError` from `@/lib/workflows`
- Produces:
  - `GET` → `WorkflowSummary[]`
  - `POST` body `{ name: string }` → `{ id: string }` (200), `{ error }` (400 empty / 409 exists)

- [ ] **Step 1: Create the file**

Create `app/api/workflows/route.ts` with:

```ts
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build succeeds; route table includes `ƒ /api/workflows`.

- [ ] **Step 4: Commit**

```bash
git add app/api/workflows/route.ts
git commit -m "feat(api): add /api/workflows GET list and POST create"
```

---

## Task 4: Replace `app/page.tsx` with dashboard server components

**Files:**
- Modify: `app/page.tsx` (replace redirect with `<Dashboard />`)
- Create: `components/dashboard.tsx` (server component)
- Create: `components/workflow-grid.tsx` (server component, reads summaries directly via lib)
- Create: `components/dashboard-empty-state.tsx` (server component)

**Interfaces:**
- Consumes: `listWorkflows`, `WorkflowSummary` from `@/lib/workflows`
- Produces:
  - `app/page.tsx` default export — async server component that renders `<Dashboard />`
  - `<Dashboard />` — server component reading summaries, rendering `<DashboardHeader />` + either `<WorkflowGrid />` or `<DashboardEmptyState />`
  - `<WorkflowGrid summaries={…} />` — server component mapping cards
  - `<DashboardEmptyState />` — server component with a "Create your first workflow" client button (full interactivity arrives in Task 5; for this task the button is a stub `<CreateWorkflowDialog />` element we will implement in Task 5 — see Step 3)

- [ ] **Step 1: Create `components/workflow-grid.tsx`**

Create with:

```tsx
import Link from "next/link"

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
          <WorkflowCard summary={summary} />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/dashboard-empty-state.tsx`**

Create with:

```tsx
import { IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { CreateWorkflowDialog } from "@/components/create-workflow-dialog"

// Client island for the dialog is added in Task 5. For now we wire only
// the trigger button; the dialog component will be a thin wrapper that
// returns `null` until Task 5 lands.

export function DashboardEmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No workflows yet</h2>
        <p className="text-sm text-muted-foreground">
          Create your first workflow to get started. It lives on disk so it
          survives browser refreshes and switches.
        </p>
      </div>
      <CreateWorkflowDialog>
        <Button type="button" tone="primary">
          <IconPlus className="size-4" stroke={2.5} aria-hidden />
          Create your first workflow
        </Button>
      </CreateWorkflowDialog>
    </div>
  )
}
```

> **Note:** the `tone="primary"` prop on `Button` does not exist yet. In Task 5 we will standardise the Button wrapper — for now, use `className="bg-primary text-primary-foreground hover:bg-primary/90"` directly on the button. Adjust this file in Step 3.

- [ ] **Step 3: Replace `components/dashboard-empty-state.tsx` content (corrected)**

Overwrite `components/dashboard-empty-state.tsx` with the corrected version that uses className directly (avoids depending on a `tone` prop that does not exist):

```tsx
import { IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { CreateWorkflowDialog } from "@/components/create-workflow-dialog"

export function DashboardEmptyState() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">No workflows yet</h2>
        <p className="text-sm text-muted-foreground">
          Create your first workflow to get started. It lives on disk so it
          survives browser refreshes and switches.
        </p>
      </div>
      <CreateWorkflowDialog>
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <IconPlus className="size-4" stroke={2.5} aria-hidden />
          Create your first workflow
        </Button>
      </CreateWorkflowDialog>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/dashboard.tsx`**

Create with:

```tsx
import { IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { listWorkflows } from "@/lib/workflows"
import { CreateWorkflowDialog } from "@/components/create-workflow-dialog"
import { DashboardEmptyState } from "@/components/dashboard-empty-state"
import { WorkflowGrid } from "@/components/workflow-grid"

export async function Dashboard() {
  const summaries = await listWorkflows()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Saved on disk under <code className="font-mono text-xs">data/</code>.
          </p>
        </div>
        <CreateWorkflowDialog>
          <Button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <IconPlus className="size-4" stroke={2.5} aria-hidden />
            New workflow
          </Button>
        </CreateWorkflowDialog>
      </header>

      {summaries.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <WorkflowGrid summaries={summaries} />
      )}
    </main>
  )
}
```

- [ ] **Step 5: Replace `app/page.tsx`**

Overwrite `app/page.tsx` with:

```tsx
import { Dashboard } from "@/components/dashboard"

export default async function Page() {
  return <Dashboard />
}
```

- [ ] **Step 6: Create the temporary `CreateWorkflowDialog` stub**

Task 5 will replace this with the real dialog. For Task 4 verification we need it to exist as a passthrough so the page compiles.

Create `components/create-workflow-dialog.tsx` with:

```tsx
"use client"

import type { ReactNode } from "react"

export function CreateWorkflowDialog({ children }: { children: ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 7: Create the temporary `WorkflowCard` stub**

Task 5 will replace this with the real card. For Task 4 verification we need it to render.

Create `components/workflow-card.tsx` with:

```tsx
import type { WorkflowSummary } from "@/lib/workflows"

export function WorkflowCard({ summary }: { summary: WorkflowSummary }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <div className="text-base font-semibold">{summary.name}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {summary.id}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {summary.nodeCount} {summary.nodeCount === 1 ? "node" : "nodes"} ·{" "}
        {summary.updatedAt}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 9: Verify build passes**

Run: `npm run build`
Expected: build succeeds; route table shows `○ /` (static, because it's a server component reading from fs at request time — Next.js will mark it as `ƒ` if it detects dynamic data, either way is fine).

- [ ] **Step 10: Commit**

```bash
git add app/page.tsx components/dashboard.tsx components/workflow-grid.tsx components/dashboard-empty-state.tsx components/create-workflow-dialog.tsx components/workflow-card.tsx
git commit -m "feat(dashboard): replace / redirect with server-component dashboard"
```

---

## Task 5: Implement `WorkflowCard` delete + `CreateWorkflowDialog`

**Files:**
- Modify: `components/workflow-card.tsx` (replace stub with client component; add delete button + AlertDialog + relative-time formatter)
- Modify: `components/create-workflow-dialog.tsx` (replace stub with real dialog: name input, submit, error handling, navigation)

**Interfaces:**
- Consumes: shadcn `AlertDialog*`, `Dialog*`, `Input`, `Button`; `useRouter` from `next/navigation`; `useState` from `react`
- Produces:
  - `WorkflowCard` (client) — click anywhere on the card navigates to `/<id>/workflow`; the delete button (top-right) stops propagation and opens an `AlertDialog`; on confirm, calls `DELETE /api/workflow/<id>` then `router.refresh()`
  - `CreateWorkflowDialog` (client) — wraps a trigger `<Button>` in a `Dialog`; submit POSTs to `/api/workflows`; on success `router.push("/<id>/workflow")`; on `409` shows inline error

> **shadcn primitives:** the `AlertDialog*` and `Dialog*` families may not be installed. Step 0 installs them.

- [ ] **Step 0: Install required shadcn primitives**

Run from the repo root:

```bash
npx shadcn@latest add alert-dialog dialog input --yes
```

Expected: files appear under `components/ui/`. If any are reported as already present, that's fine — proceed.

- [ ] **Step 1: Implement `components/workflow-card.tsx`**

Overwrite `components/workflow-card.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { IconTrash } from "@tabler/icons-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { WorkflowSummary } from "@/lib/workflows"

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const seconds = Math.round((now - then) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.round(seconds / 86_400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function WorkflowCard({ summary }: { summary: WorkflowSummary }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/workflow/${summary.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
      setDeleting(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="space-y-1">
        <div className="text-base font-semibold">{summary.name}</div>
        <div className="font-mono text-xs text-muted-foreground">
          {summary.id}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {summary.nodeCount} {summary.nodeCount === 1 ? "node" : "nodes"} ·{" "}
        {formatRelative(summary.updatedAt)}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete workflow ${summary.name}`}
            className="absolute right-2 top-2 size-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => e.stopPropagation()}
            disabled={deleting}
          >
            <IconTrash className="size-4" aria-hidden />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{summary.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the workflow file from{" "}
              <code className="font-mono text-xs">data/{summary.id}.json</code>.
              You can&apos;t undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Implement `components/create-workflow-dialog.tsx`**

Overwrite `components/create-workflow-dialog.tsx` with:

```tsx
"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CreateWorkflowDialog({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName("")
    setError(null)
    setSubmitting(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const { id } = (await res.json()) as { id: string }
      setOpen(false)
      reset()
      router.push(`/${id}/workflow`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed")
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              Give it a name. Special characters become underscores in the URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="workflow-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My workflow"
              autoFocus
              disabled={submitting}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: exits 0. If `Input`/`Button`/`Dialog`/`AlertDialog` re-export anything unusual, address import paths.

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/workflow-card.tsx components/create-workflow-dialog.tsx components/ui
git commit -m "feat(dashboard): wire card delete and create-workflow dialog"
```

---

## Task 6: Wire workflow name into the editor

**Files:**
- Modify: `components/sidebar.tsx` (add a name `<Input>` at the top; new props `name`, `onNameChange`)
- Modify: `components/canvas.tsx` (track `workflowName` state; seed from GET response; pass to `Sidebar`; include in save body)

**Interfaces:**
- Consumes: existing `Sidebar` props; existing `Canvas` save handler
- Produces:
  - `Sidebar` accepts `name: string` and `onNameChange: (name: string) => void`
  - `Canvas` stores `workflowName` in state; on save, includes it in the POST body

- [ ] **Step 1: Inspect current `Sidebar` and `Canvas` shapes**

Open `components/sidebar.tsx` and `components/canvas.tsx`. Locate:
- `Sidebar`'s `SidebarProps` type (top of file)
- `Sidebar`'s render root (`<div className={cn("flex flex-col gap-2", className)}>`)
- `Canvas`'s state hooks (likely `useState` calls early in the function)
- `Canvas`'s save handler (search for `await fetch` or `/api/workflow/`)

You will use the exact line numbers in Steps 2 and 3.

- [ ] **Step 2: Add name prop + input to `components/sidebar.tsx`**

In `SidebarProps`, add two fields:

```ts
  name: string
  onNameChange: (name: string) => void
```

In the `Sidebar` destructuring, add `name, onNameChange` (without defaults).

At the top of the JSX returned by `Sidebar` (before the existing `<ActionButton groupName="add-node" ... />`), insert:

```tsx
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Workflow name"
        aria-label="Workflow name"
        className="h-9"
      />
```

Add `Input` to the imports at the top of `sidebar.tsx`:

```ts
import { Input } from "@/components/ui/input"
```

(If `Input` is not yet installed, run `npx shadcn@latest add input --yes` first.)

- [ ] **Step 3: Add name state to `components/canvas.tsx`**

Add to imports at the top (alongside the existing `useState` import — it should already be there):

```ts
import { useState } from "react"
```

is already present. Confirm. Then:

(a) Add state. Find the line that holds the existing `const [hasChanges, setHasChanges] = useState(false)` (or the closest analogue) and add immediately above it:

```tsx
  const [workflowName, setWorkflowName] = useState<string>("")
```

(b) Seed `workflowName` from the GET response. Find the `fetch(\`/api/workflow/${workflowId}\`)` call's `.then((r) => r.json())` (or equivalent) and add the assignment:

```tsx
        const data = (await res.json()) as {
          name?: string
          nodes: Node<NodeData>[]
          edges: Edge[]
        }
        setWorkflowName(data.name ?? workflowId)
```

(c) Pass `name` and `onNameChange` to `<Sidebar />`. In the JSX where `<Sidebar ... />` is rendered, add two props:

```tsx
        name={workflowName}
        onNameChange={(next) => {
          setWorkflowName(next)
          setHasChanges(true)
        }}
```

(d) Include `name` in the save body. Find the `body: JSON.stringify(...)` inside the save `fetch` and replace it with:

```tsx
        body: JSON.stringify({
          name: workflowName,
          nodes,
          edges,
        }),
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: build succeeds; full route table rendered.

- [ ] **Step 7: Commit**

```bash
git add components/sidebar.tsx components/canvas.tsx
git commit -m "feat(editor): persist workflow display name through save"
```

---

## Task 7: Manual end-to-end smoke

No code changes in this task. Drives the running app to confirm the spec's verification list works.

**Files:** none.

- [ ] **Step 1: Start dev server**

In one terminal:

```bash
npm run dev
```

Wait for "Ready in …" output.

- [ ] **Step 2: Open `/` in the browser**

Expected: dashboard renders with one card for `default.json` showing name "default" (since the existing file has no `name` field, it falls back to id), 2 nodes, and a recent timestamp.

- [ ] **Step 3: Click the existing card**

Expected: navigates to `/default/workflow` and the existing Trigger + Request graph loads.

- [ ] **Step 4: Click "New workflow"**

Expected: dialog opens with name input. Type "Test flow" and submit. Expected: navigates to `/Test_flow/workflow`, the canvas is empty initially, then seeds itself with the Trigger + Request default on mount.

- [ ] **Step 5: Verify the new workflow shows in the dashboard**

Click Save (or just press the sidebar's Save button — note that the empty seed state has no changes, so first add a node then save). Then navigate to `/`. Expected: card for `Test_flow` appears with name "Test flow", 2 nodes, recent timestamp.

- [ ] **Step 6: Test name editing**

Open the new workflow's editor. Change the name input in the sidebar to "Renamed". Press Save. Navigate to `/`. Expected: card now shows "Renamed" as the display name, id still `Test_flow`.

- [ ] **Step 7: Test delete**

Click the trash icon on a card. Expected: AlertDialog confirms. Click Delete. Expected: card disappears from the list; the file is gone from `data/`.

- [ ] **Step 8: Test empty state**

```bash
mv data data.bak
```

Refresh `/`. Expected: empty state with "Create your first workflow" button.

Click the button. Create one named "First". Expected: navigates to its editor.

```bash
rm -rf data
mv data.bak data
```

This restores the original state.

- [ ] **Step 9: Test sanitization**

Create a workflow named "Hello World!!". Expected: id is `Hello_World__` (preserves case, spaces and `!` become `_`). URL is `/Hello_World__/workflow`.

- [ ] **Step 10: Stop the dev server**

`Ctrl+C` in the dev terminal.

---

## Self-Review

**1. Spec coverage** (each spec section → task):
- Storage lib / types / functions → Task 1 ✓
- Refactor existing route handler + DELETE → Task 2 ✓
- New `/api/workflows` GET/POST → Task 3 ✓
- `/` page becomes dashboard server component → Task 4 ✓
- Card with delete + relative time + AlertDialog → Task 5 ✓
- Create dialog with name input + 409 error handling → Task 5 ✓
- Empty state → Task 4 ✓
- Sidebar name input + canvas name state + save body → Task 6 ✓
- Verification list → Task 7 ✓

**2. Placeholder scan:** no "TBD"/"TODO"/"add appropriate"/etc. All code blocks are concrete.

**3. Type consistency:** `WorkflowSummary`, `WorkflowSnapshot`, `WorkflowExistsError`, `sanitizeId`, `listWorkflows`, `getWorkflow`, `saveWorkflow`, `deleteWorkflow`, `createWorkflow` are defined in Task 1 and used identically in Tasks 2, 3, 4, 5. No naming drift.

**4. Issues caught and fixed during self-review:**
- Initial Task 4 referenced a non-existent `tone="primary"` Button prop — corrected to use className directly.
- Task 4 needed stubs of `WorkflowCard` and `CreateWorkflowDialog` so the page would compile — explicitly listed as Steps 6 and 7.
- Task 5 explicitly installs the required shadcn primitives (`alert-dialog`, `dialog`, `input`) via Step 0 so a fresh checkout doesn't fail.
- Task 6 Step 3 has explicit instructions for which existing lines to modify in `canvas.tsx`, since the file is large and a directive without anchors would be guesswork.