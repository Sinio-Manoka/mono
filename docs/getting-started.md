# Getting started

## Prerequisites

- **Node.js 20+** (Next.js 16 requires it).
- **npm** (or pnpm / yarn — the lockfile is npm-only but the scripts are
  package-manager-agnostic).

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be bounced
to `/default/workflow`, a starter canvas with a Trigger and a sample
Request already wired up. Click the Manual trigger (the lightning bolt)
to run it, or hit **Run** in the sidebar.

## Your first workflow

1. **Add a node.** Click the **+** button in the sidebar to open the
   node picker. Pick "Request". The new node lands on the canvas.
2. **Connect it.** Drag from the right handle of your Trigger to the
   left handle of the new Request. A line appears between them.
3. **Configure it.** Double-click the Request. The Inspector opens on
   the right. Fill in a URL — e.g.
   `https://jsonplaceholder.typicode.com/posts/1`.
4. **Reference earlier results.** If you have a Request that returns
   JSON, you can pass a field from its response to the next request.
   In a later Request's URL field, type something like
   `https://jsonplaceholder.typicode.com/users/{{Request.userId}}` —
   where `Request` is the **label** of the upstream node, and
   `userId` is a path into its result.
5. **Save.** Click **Save** in the sidebar (or `Ctrl/Cmd+S`). Your
   workflow is now persisted to `data/default.json` (or
   `data/<your-id>.json` if you used a custom id).
6. **Run.** Click the trigger or the Run button. Watch the node rings
   turn blue → green (or red) as the graph executes.

## Workflows live under ids

The URL pattern is `http://localhost:3000/<id>/workflow`. The id is
free-form — it's sanitized to `[a-zA-Z0-9_-]` before being used as a
filename, so use any reasonable slug. Treat it like a project name.

Examples:

```
http://localhost:3000/default/workflow      # the seeded starter
http://localhost:3000/stripe-sync/workflow   # your own
http://localhost:3000/etl-pipeline/workflow # another
```

## Importing and exporting

- **Export:** click the **Download** icon in the sidebar. A JSON file
  containing `{ nodes, edges }` downloads.
- **Import:** click the **Upload** icon. Pick a JSON file. The current
  workflow is replaced (after a brief confirmation if you have unsaved
  changes).

Exports are interoperable with the persisted files in `data/<id>.json`
— they have the same shape.

## Storage: where do my workflows go?

`data/<id>.json`, one file per workflow id. The `data/` directory is
git-ignored by default. For production with multiple replicas you'll
want a real database — see [architecture.md](./architecture.md#storage)
for the swap point.

## Light / dark theme

Press the `d` key (when not typing in an input) to toggle. The
React Flow canvas follows the theme automatically because both share
the same shadcn design tokens.

## Dev toolbar (agentation)

In development you'll see an agentation floating button bottom-right
when running locally. It's a visual feedback overlay for AI coding
agents. It ships as `null` in production builds.
