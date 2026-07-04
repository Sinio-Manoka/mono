# Workflow Dashboard — Design

**Date:** 2026-07-04
**Status:** Approved (pending user review of written spec)

## Problem

The app currently has no home screen. `app/page.tsx` redirects `/` to `/default/workflow`, so the only way to reach the editor is to know the workflow id. Once users create more than one workflow (today: just one), there's no way to discover or switch between them.

## Goal

Replace `/` with a dashboard that lists every workflow stored on disk. From the dashboard the user can open any workflow, create a new one, and delete existing ones. Workflow data continues to live only on the server's filesystem — nothing is persisted in the browser, so progress is not lost on browser change, refresh, or crash.

## Non-goals

- Authentication / multi-user separation. Workflows are local files in a gitignored directory; this stays single-user / single-environment.
- Search, tags, folders, or sorting. The list is sorted by `updatedAt` descending and that's it.
- Renaming workflows in place via the dashboard. The dashboard can delete + recreate. Editing the name happens in the editor.
- Migrating away from the file-backed store. CLAUDE.md already notes this should be swapped for a DB in multi-replica production; this design does not pre-empt that change but does isolate the filesystem calls behind a single lib so the swap is mechanical.

## Storage: `lib/workflows.ts` (new)

The single seam for all workflow persistence. Server-only — uses `fs`/`path` from `node:fs`/`node:path`. Both route handlers and server components import from here.

### Types

```ts
export type WorkflowSnapshot = {
  name?: string               // optional display name; absent ⇒ falls back to id
  nodes: Node<NodeData>[]
  edges: Edge[]
}

export type WorkflowSummary = {
  id: string                  // sanitized filename without .json
  name: string                // snapshot.name ?? id
  nodeCount: number
  updatedAt: string           // ISO 8601 of file mtime
}

export class WorkflowExistsError extends Error {
  constructor(public readonly id: string) {
    super(`Workflow already exists: ${id}`)
  }
}
```

### Functions

| Function | Behavior |
|---|---|
| `sanitizeId(raw: string): string` | Apply `raw.replace(/[^a-zA-Z0-9_-]/g, "_")` then fall back to `"default"` if empty. Centralizes the rule that already lives in `app/api/workflow/[id]/route.ts`. |
| `listWorkflows(): Promise<WorkflowSummary[]>` | `fs.readdir(DATA_DIR)`, filter `.json`, for each: parse `nodes.length`, read `fs.statSync().mtime`. Skip + `console.warn` on parse errors or shape mismatches. Sort by `updatedAt` descending. |
| `getWorkflow(id: string): Promise<WorkflowSnapshot \| null>` | Read file, parse, return `null` on ENOENT or parse failure. |
| `saveWorkflow(id: string, snapshot: WorkflowSnapshot): Promise<void>` | `fs.mkdir(DATA_DIR, { recursive: true })` then `fs.writeFile`. |
| `deleteWorkflow(id: string): Promise<void>` | `fs.unlink`; ignore ENOENT (treat as already gone). |
| `createWorkflow(name: string): Promise<{ id: string }>` | Slugify `name` to derive `id` (lowercase, spaces→`-`, then `sanitizeId`); if a file already exists at `data/<id>.json`, throw `WorkflowExistsError`; otherwise `saveWorkflow(id, { nodes: [], edges: [] })` and return `{ id }`. |

The `DATA_DIR` constant (`path.join(process.cwd(), "data")`) lives in this file. The existing `app/api/workflow/[id]/route.ts` is refactored to call these helpers and loses its own DATA_DIR / sanitizer constants.

## Route handlers

| Route | Methods | Behavior |
|---|---|---|
| `/api/workflows` | `GET` | Returns `WorkflowSummary[]`. |
| `/api/workflows` | `POST` | Body: `{ name: string }`. Validates non-empty. Calls `createWorkflow`. Returns `{ id }` on success, `409 { error: "Workflow already exists" }` on `WorkflowExistsError`, `400 { error: "Name is required" }` on empty. |
| `/api/workflow/[id]` | `GET` | **Existing** — refactored to call `getWorkflow`. Behavior unchanged: returns `{ nodes: [], edges: [] }` when file is absent. |
| `/api/workflow/[id]` | `POST` | **Existing** — refactored to call `saveWorkflow`. Behavior unchanged. Now accepts the optional `name` field on the snapshot. |
| `/api/workflow/[id]` | `DELETE` | **New.** Calls `deleteWorkflow`. Returns `{ ok: true }` on success, `404` if the file was already gone. |

## Pages

### `/` — Dashboard (was: redirect)

`app/page.tsx` becomes an async server component. On the server:
1. Call `listWorkflows()`.
2. If empty, render the empty-state component.
3. Otherwise render the header + `<WorkflowGrid>` with cards.

The page is the server entry. The cards and dialog are client islands.

### `/[id]/workflow` — Editor (unchanged route)

`app/[id]/workflow/page.tsx` is unchanged in shape. The editor's `Sidebar` gains a workflow-name input at the top.

## Components (new)

| File | Type | Purpose |
|---|---|---|
| `components/dashboard.tsx` | server | Top-level layout: header, `<WorkflowGrid>` (or empty state). |
| `components/workflow-grid.tsx` | server | Renders cards in a responsive grid. No interactivity of its own. |
| `components/workflow-card.tsx` | client | Clickable card. Click → `router.push("/<id>/workflow")`. Delete button (stops propagation) → opens AlertDialog. On confirmed delete → `DELETE /api/workflow/<id>` → `router.refresh()`. |
| `components/create-workflow-dialog.tsx` | client | Modal with name input. Submit → `POST /api/workflows`. On success → `router.push("/<newId>/workflow")`. On `409` → inline error. |
| `components/dashboard-empty-state.tsx` | server | Centered card with a single "Create your first workflow" button (opens the same dialog). |

## Components (modified)

### `components/sidebar.tsx`

Add a workflow-name `<Input>` at the very top, above the existing action buttons. New prop `name: string`, `onNameChange: (name: string) => void`. The input is uncontrolled-feeling (controlled), and `onNameChange` is fired on every keystroke. The canvas (the only caller) wires `onNameChange` to update its in-memory snapshot and set `hasChanges = true` so the existing Save button picks it up.

### `components/canvas.tsx`

- New `workflowName` state, mirrored from the prop on the GET result.
- Passes `name={workflowName}` and `onNameChange={setWorkflowName}` to `Sidebar`.
- Before save, includes `name` in the POST body: `{ name: workflowName, nodes, edges }`.
- GET parsing accepts the optional `name` field and stores it in state.

## UI

- Cards use shadcn `Card` with `CardHeader`, `CardContent`, `CardFooter` (or similar). Light/dark via the existing `[data-theme="dark"]` tokens in `app/globals.css` — no new tokens.
- Name input in the sidebar uses shadcn `Input`.
- Create dialog uses shadcn `Dialog` (or `AlertDialog` if simpler; `Dialog` is the right primitive for a form).
- Delete confirmation uses shadcn `AlertDialog`.
- Icons from `@tabler/icons-react` (already a dep): `IconPlus`, `IconTrash`, `IconWorkflow` (or similar) for empty state.

### Relative time formatting

Hand-rolled, no new dep:

```ts
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
```

## Error handling summary

| Situation | Behavior |
|---|---|
| `data/` doesn't exist | Empty state shown; `saveWorkflow`/`createWorkflow` create the dir on demand. |
| A `.json` in `data/` fails to parse | Skip in listing, `console.warn`. Editor GET returns empty. |
| Create with empty name | `400 { error: "Name is required" }`, dialog blocks submit. |
| Create with id collision | `409 { error: "Workflow already exists" }`, dialog shows inline. |
| Delete a missing workflow | `404`. Client still calls `router.refresh()`. |
| GET missing workflow (existing) | Returns `{ nodes: [], edges: [] }` (unchanged). |
| Sanitization edge case | Empty input → id `"default"` (same as existing route). |

## Verification

No test runner wired up. Verification is manual + scripts:

1. `npm run typecheck` — passes.
2. `npm run build` — passes.
3. `npm run lint` — passes.
4. End-to-end smoke (`npm run dev`):
   - Visit `/` → existing `default.json` shows as a card with display name, id, node count, and relative mtime.
   - Click card → lands on `/default/workflow` with existing graph.
   - "New workflow" → name "Test flow" → submit → lands on `/Test_flow/workflow` with empty canvas; canvas seeds itself with the Trigger + Request default.
   - Save the empty state, refresh `/` → "Test flow" appears with `2 nodes` and recent mtime.
   - Edit name in the sidebar to "Renamed", save → refresh `/` → card shows "Renamed".
   - Click delete on a card → confirm dialog → list updates.
   - Empty the directory manually, restart, visit `/` → empty state with "Create your first workflow" button.
5. Sanitization check: create "Hello World!!" → URL becomes `/Hello_World__/workflow`.

## Files touched

### New

- `lib/workflows.ts`
- `components/dashboard.tsx`
- `components/workflow-grid.tsx`
- `components/workflow-card.tsx`
- `components/create-workflow-dialog.tsx`
- `components/dashboard-empty-state.tsx`
- `app/api/workflows/route.ts`

### Modified

- `app/page.tsx` (replace redirect with dashboard)
- `app/api/workflow/[id]/route.ts` (refactor to call `lib/workflows.ts`; add DELETE)
- `components/sidebar.tsx` (add name input)
- `components/canvas.tsx` (track `workflowName`, include in save body)