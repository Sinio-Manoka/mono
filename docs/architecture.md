# Architecture

A tour of the moving parts. This is the doc to read when you're about
to change something non-trivial and want to know what else will move.

## High-level data flow

```
┌──────────────┐    GET /api/workflow/<id>    ┌────────────────────┐
│   Browser    │ ───────────────────────────► │  Next.js route     │
│              │ ◄─────────────────────────── │  handler           │
│  ┌────────┐  │                              └────────┬───────────┘
│  │ Canvas │  │                                       │ fs
│  │ (RF)   │  │    POST /api/workflow/<id>           ▼
│  └────────┘  │ ───────────────────────────► data/<id>.json
│              │
│              │    POST /api/execute-workflow
│              │ ───────────────────────────► ┌────────────────────┐
│              │ ◄════════════════════════════ │  Streaming NDJSON  │
└──────────────┘   one line per step          │  executeWorkflow() │
                                              └────────────────────┘
```

Three things cross the wire:

1. **The workflow snapshot** (`{ nodes, edges }`) — saved and loaded
   per-id, file-backed.
2. **The execution stream** — an NDJSON response, one event per node
   start / success / error.
3. **The trigger request** (in the future) — when the "On Request"
   trigger fires, an external HTTP call into the workflow.

## The Canvas

`components/canvas.tsx` is the React Flow surface and the main
controller. It owns:

- The `nodes` and `edges` state.
- The history stack (undo / redo) with separate redo stack.
- The "last saved" snapshot used to compute `hasChanges` (drives the
  Save button's label).
- The `inspectorNodeId` — Inspector is opened on **double click**,
  not single click, so single clicks can still highlight the node
  ring without opening the drawer.
- The clipboard for copy / paste.
- Keyboard shortcuts (via `lib/use-keyboard-shortcuts.ts`).

Initial load fetches `/api/workflow/<id>`. If a snapshot exists, it's
hydrated; otherwise the user starts with the seeded `initialNodes` /
`initialEdges` (one Manual trigger and one Request).

### History (undo / redo)

- Every **structural change** (add / remove / reconnect) is recorded
  immediately.
- Every **data edit** (URL, headers, body, etc.) is recorded after
  an 800ms debounce so a burst of typing collapses to one entry.
- A new edit truncates the redo stack.
- The history is capped at 20 entries.

The sidebar shows a list of history entries with **restore** (jump to
that state), **preview** (hover to peek at the canvas state), **delete**
(remove the entry), and **download** (export that specific snapshot
as JSON).

## The node system

Three files drive every node:

- **`components/nodes/types.ts`** — the data shapes (`TriggerNodeData`,
  `RequestNodeData`, `NodeData = union`), the `NodeDefinition`
  interface, and the `NODE_CATALOG` array.
- **`components/nodes/<type>-node.tsx`** — the visual renderer for
  each type. Receives an `onUpdate` callback bound to the canvas's
  `updateNodeData` and the current `executionStatus` prop.
- **`lib/execute-workflow.ts`** — the executor map: one async function
  per `type` that knows how to actually run that kind of node.

### `NODE_CATALOG` is the single source of truth

The node picker, the create dialog's inline form, and the Inspector
all read from the same `NodeDefinition[]`. **To add a new node
type:**

1. Add a `NodeDefinition` to `NODE_CATALOG` in
   `components/nodes/types.ts`.
2. Add a renderer in `components/nodes/`.
3. Add an executor in `lib/execute-workflow.ts`.
4. Register the renderer in the `nodeTypesFor(...)` map at the top
   of `components/canvas.tsx`.

The picker, dedup (`UNIQUE_CATALOG_KEYS`), and the form
auto-include the new node. See [nodes.md](./nodes.md) for the full
walkthrough.

## The expression language

`{{NodeLabel.path}}` — any string field of a Request node can contain
template expressions. They're resolved by
`lib/execute-workflow.ts::resolveExpressions` against the running
`nodeResults` map, which is keyed by node label and updated after
each successful step.

Path resolution is delegated to `lib/expression-path.ts`, which
accepts both dot and bracket notation in any combination:

```
{{Request.body[0].user.id}}
{{Trigger.input.items[2].name}}
```

Unresolved expressions (unknown label, unknown path) are left
untouched in the output, so the user can see what's missing.

Full grammar and edge cases: [expressions.md](./expressions.md).

## The executor

`executeWorkflow(nodes, edges, startId)` is an **async generator** —
each step (`start` / `success` / `error`) is `yield`ed to the caller
so the API can stream it and the UI can update between nodes. The
caller consumes the generator from inside a `ReadableStream`'s
`start` controller, encoding each step as one NDJSON line.

A failed node stops its own branch — its downstream neighbors are
not queued — but other branches continue. This is intentional: one
bad call shouldn't poison the rest of the graph.

## Storage

`app/api/workflow/[id]/route.ts` is a thin filesystem adapter. The
contract the client depends on is the route shape:

- `GET /api/workflow/<id>` → `{ nodes: Node[]; edges: Edge[] }` (or
  an empty `{ nodes: [], edges: [] }` if nothing is saved yet).
- `POST /api/workflow/<id>` body → same shape, replaces the snapshot.
  Returns `{ ok: true }`.

The id is sanitized to `[a-zA-Z0-9_-]` before being used as a
filename (so a crafted id like `../../etc/passwd` cannot escape the
`data/` dir). The `data/` directory is git-ignored.

**To swap for a real database** (Postgres, SQLite, S3, whatever):
rewrite `readWorkflow` and `writeWorkflow` in that route file. The
client doesn't need to change.

## React Flow theming

The canvas wrapper carries an inline `style` that maps every
`--xy-*` user-facing variable React Flow reads to the shadcn tokens
in `app/globals.css` (`--background`, `--card`, `--muted-foreground`,
`--primary`, etc.). The shadcn tokens themselves switch with
`[data-theme="dark"]`, so the RF surface follows light/dark mode
without duplication.

**Why inline, not `:root` in `globals.css`.** A `:root { --xy-* }`
block was being stripped at build time by Tailwind v4's content-aware
CSS tree-shake. The only references to those variables live in
`node_modules/@xyflow/react/dist/style.css`, which Tailwind doesn't
scan, so it concluded the declarations were unused. Inline `style`
bypasses that pass and is the only way to keep the variables in the
cascade without re-declaring every shadcn token locally.

**If you add a new RF variable later**, append it to
`reactFlowThemeStyle` in `components/canvas.tsx`. Do **not** add it
to `globals.css` — Tailwind will strip it.

## Server vs client components

- **Server:** `app/layout.tsx`, `app/page.tsx`,
  `app/[id]/workflow/page.tsx`. Pages and layouts are server
  components by default; they handle params and route to client
  components.
- **Client:** everything in `components/`, plus the route handlers
  in `app/api/`. Marked with `"use client"` at the top.

`app/[id]/workflow/page.tsx` is a notable example: it awaits
`params` (a `Promise<{ id: string }>` in Next.js 15+) on the server,
then renders the client `<Canvas workflowId={id} />`.

## Styling

Tailwind v4 is configured via PostCSS only — there is no
`tailwind.config.*` file. All design tokens live as CSS custom
properties in `app/globals.css` under `@theme inline { ... }`, with
`:root` and `[data-theme="dark"]` defining the oklch values.

The dark variant is keyed off `[data-theme="dark"] *` (set by
`next-themes`), not `.dark` — the standard shadcn `dark:` variant
would silently fail to match here. Custom CSS in the codebase uses
the same `data-theme` selector.

## Why these choices

A few non-obvious decisions, in case you're wondering whether to
reverse them:

- **`hooks/` is empty** — custom hooks currently live in `lib/`
  (`use-keyboard-shortcuts.ts`). The `hooks/` directory has a
  `.gitkeep` placeholder; move them there if/when the count grows.
- **`UNIQUE_CATALOG_KEYS` is a `ReadonlySet<string>`** — declared
  at the bottom of `components/nodes/types.ts`. The Canvas consults
  it when adding a node to dedupe ("only one manual trigger per
  workflow").
- **`data/` is git-ignored** — each developer has their own
  snapshots. Don't commit workflow JSON.
- **`@theme inline` instead of tokens in JS** — the design tokens
  are CSS-only so any consumer (a docs site, an iframe) can render
  the same look without importing the React tree.
