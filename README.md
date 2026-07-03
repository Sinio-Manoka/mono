# Mono

A visual workflow editor for stitching together HTTP requests, no-code style.

Drag triggers and requests onto a canvas, wire them together, and Mono runs
the graph for you — calling out to public APIs, threading the previous
response's data into the next call via `{{NodeLabel.path}}` expressions, and
streaming each step's result back to the UI as it executes.

> **Status:** pre-1.0. APIs may shift. See [docs/roadmap.md](docs/roadmap.md)
> for what's planned, including the upcoming hosted SaaS offering.

## Features

- **Drag-and-drop canvas** powered by React Flow — pan, zoom, connect nodes.
- **Two node types today**, extensible through a single catalog:
  - **Manual trigger** — fires the workflow from the in-app run button.
  - **On Request trigger** — exposes the workflow as an HTTP endpoint.
  - **HTTP Request** — GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS with query
    params, headers, body (raw / form-urlencoded / form-data / GraphQL), and
    Bearer auth.
- **`{{NodeLabel.path}}` expressions** for piping data between nodes —
  `{{Request.body[0].id}}` style paths with both dot and bracket notation.
- **Live streaming execution** — the API streams NDJSON events as each
  node starts / succeeds / errors, so the UI can light up the right node
  the moment it runs.
- **Undo / redo with a visual history** — every structural change and
  debounced data edit becomes a recoverable entry, with restore, preview,
  delete, and download actions.
- **Keyboard shortcuts** — undo, redo, copy, paste, save. (See
  [docs/development.md](docs/development.md) for the full list.)
- **Import / export** — download a workflow as JSON, load one back.
- **File-backed storage** — each workflow is one JSON file under `data/`,
  safe to commit-ignore. Swap for a real database later without touching
  the route shape.
- **Light / dark theme** with a `d` keyboard hotkey to toggle.
- **Agentation dev toolbar** for in-browser feedback to AI agents.

## Quick start

```bash
# Node 20+ recommended
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected
to `/default/workflow`, a starter canvas with a Trigger and a sample
Request wired together. Hit the **Run** button (or click the Manual trigger
node) to execute the workflow.

To work on a separate workflow, point your browser at any id:

```
http://localhost:3000/<your-id>/workflow
```

Each id is a self-contained workflow; snapshots live in `data/<id>.json`
(treated as `replace(/[^a-zA-Z0-9_-]/g, "_")` for safety).

### Scripts

| Command            | What it does                                       |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Start the Next.js dev server on port 3000          |
| `npm run build`    | Production build                                   |
| `npm run start`    | Serve the production build                         |
| `npm run lint`     | ESLint (flat config, `core-web-vitals` + TS rules) |
| `npm run typecheck`| `tsc --noEmit`                                     |
| `npm run format`   | Prettier write (Tailwind classes sorted)           |

## Tech stack

- **[Next.js 16](https://nextjs.org)** — App Router, server components,
  route handlers, streaming responses.
- **[React 19](https://react.dev)** + TypeScript strict.
- **[Tailwind v4](https://tailwindcss.com)** — design tokens in
  `app/globals.css` under `@theme inline`, light + `[data-theme="dark"]`
  variants, no JS config.
- **[shadcn/ui](https://ui.shadcn.com)** — `radix-luma` style, `mist` base
  color, `@tabler/icons-react` icon set.
- **[React Flow v12](https://reactflow.dev)** — the canvas, themed via
  shadcn tokens (see [docs/architecture.md](docs/architecture.md#react-flow-theming)).
- **[next-themes](https://github.com/pacocoursey/next-themes)** — theme
  provider, with a `d`-key hotkey to toggle.
- **[agentation](https://www.agentation.com)** — dev-only AI feedback
  overlay.

## Project layout

```
app/
  layout.tsx                       Root layout, mounts providers
  page.tsx                         "/" → "/default/workflow"
  globals.css                      Tailwind v4 + design tokens
  [id]/workflow/page.tsx           The editor (server component)
  api/workflow/[id]/route.ts       GET/POST a workflow snapshot
  api/execute-workflow/route.ts    POST, streams NDJSON execution steps

components/
  canvas.tsx                       React Flow surface + history + shortcuts
  sidebar.tsx, inspector.tsx, history-panel.tsx
  create-node-dialog.tsx           Node picker (driven by NODE_CATALOG)
  *-editor.tsx, *-viewer.tsx       Per-field input components
  nodes/                           Node renderers + the catalog/types
  ui/                              shadcn primitives
  theme-provider.tsx, agentation.tsx

lib/
  execute-workflow.ts              Graph executor (async generator)
  expression-path.ts               {{a.b[0]}} path resolver
  execution-status.ts              Per-node run status enum
  use-keyboard-shortcuts.ts        Stable-listener hook
  utils.ts                         cn() helper
```

For the full picture, read [docs/architecture.md](docs/architecture.md).

## How a workflow runs

1. The user clicks **Run** (or hits the Manual trigger). The canvas POSTs
   `{ nodes, edges, startId }` to `/api/execute-workflow`.
2. The route returns a `ReadableStream` of NDJSON. Each line is one
   `ExecutionStep` (`start` → `success` | `error`).
3. `lib/execute-workflow.ts` walks the graph from `startId` using BFS.
   For each node it picks the executor registered for the node's
   `type`, runs it, and yields the result. The previous node's result
   becomes the `input` for downstream nodes; downstream nodes can also
   reference earlier results via `{{Label.path}}` expressions resolved
   from the running `nodeResults` map.
4. A failed node stops its own branch — downstream nodes are not queued
   for it — but other branches continue.
5. Each execution step updates the corresponding node's `executionStatus`
   prop in the canvas (blue ring while running, green on success, red on
   error).

## Extending

- **Add a new node type** — append a `NodeDefinition` to `NODE_CATALOG`
  in [components/nodes/types.ts](components/nodes/types.ts), then add
  a matching executor in [lib/execute-workflow.ts](lib/execute-workflow.ts).
  Full walkthrough in [docs/nodes.md](docs/nodes.md).
- **Persist workflows somewhere real** — replace
  [app/api/workflow/[id]/route.ts](app/api/workflow/[id]/route.ts)'s
  filesystem adapter with a database client. The route shape
  (`GET` returns `{ nodes, edges }`, `POST` accepts the same) is the
  only client contract.
- **Run as SaaS** — see [docs/roadmap.md](docs/roadmap.md) for the plan.

## Documentation

- [docs/getting-started.md](docs/getting-started.md) — first workflow,
  the editor UI, where things live.
- [docs/architecture.md](docs/architecture.md) — data flow, the node
  system, the expression resolver, theming, storage.
- [docs/development.md](docs/development.md) — dev workflow, scripts,
  conventions, troubleshooting.
- [docs/nodes.md](docs/nodes.md) — adding new node types end-to-end.
- [docs/expressions.md](docs/expressions.md) — the `{{...}}` expression
  language.
- [docs/api.md](docs/api.md) — HTTP API reference.
- [docs/roadmap.md](docs/roadmap.md) — what's next, including SaaS.

## Contributing

Bug reports and feature requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md) for the workflow. Pull requests are
accepted under the project's [license](LICENSE).

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0) — everyone
is free to use, modify, and contribute, including for commercial
purposes. The "no selling proprietary forks" part is enforced through
**network copyleft**: if you run a modified version as a network
service, you must also publish the source of your modifications under
the same license. This is what lets the project remain open while
still letting us offer a hosted SaaS product on top of it later. A
commercial license (for teams that want to run a closed-source
derivative) will be available alongside the SaaS launch — see
[docs/roadmap.md](docs/roadmap.md) for timing.
