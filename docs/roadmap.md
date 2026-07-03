# Roadmap

Where the project is headed, in rough priority order. Nothing here
is committed — dates and scope will shift as we learn.

## Now (pre-1.0)

- Polish the editor UX. On the list:
  - Inline validation for `{{...}}` expressions (the inspector
    already tells you a path is invalid; we want to make that
    read more clearly).
  - Snapping and alignment helpers in the canvas.
  - Better error toasts when a save fails (currently silent).
- More node types. Likely candidates:
  - **Code** — run a sandboxed JS expression. Useful for shaping
    data without spinning up a real backend.
  - **If / Switch** — branch on an upstream value.
  - **Schedule** — cron-style recurring trigger.
- **Per-workflow storage** — the URL already carries the id; the
  file-backed route handler does too. Plumbing is in place; we
  just need a UI to pick a workflow and an index endpoint.

## Next (1.0)

- **Tests.** The repo currently has no test runner. Likely Vitest
  for unit tests of the expression resolver and executor, plus
  Playwright for the editor itself.
- **Real persistence.** The filesystem adapter in
  `app/api/workflow/[id]/route.ts` is a placeholder. Swap for
  SQLite (simple, file-based, works on a single host) or Postgres
  (multi-replica). The route shape is the only contract the
  client cares about.
- **Authentication.** Local-only today. A real auth layer is
  needed before we can offer anything else.
- **Observability.** Structured logs, basic metrics (runs per
  workflow, failure rate, latency), and a debug page that shows
  recent runs.

## Later (post-1.0)

- **Hosted SaaS.** The plan is to run Mono as a managed service —
  sign up, get a workspace, build workflows in the browser, hit a
  hosted `/api/trigger/{id}` endpoint to fire them. Self-hosted
  single-user mode will remain free and source-available under
  the same [license](../LICENSE).
- **A commercial license.** Alongside the SaaS launch, a separate
  commercial license will be available for teams that want to run
  Mono on their own infrastructure as a closed-source product.
  AGPL-3.0 continues to apply to the open-source release.
- **Shared workflow library.** Browse and import workflows
  authored by others. Likely with a rating / review layer.
- **Versioning.** Currently `data/<id>.json` is a single
  always-overwritten file. A proper history endpoint
  (`GET /api/workflow/{id}/history`) would let users diff and
  restore old versions.

## Out of scope (for now)

- **Code generation.** No "export as TypeScript" or similar. The
  internal model is the source of truth.
- **Multi-tenant by default.** The file-backed store is per-host.
  Multi-tenant is a SaaS concern, not a self-hosted one.
- **A visual debugger / step-through.** The streaming execution
  + per-node status already gives a good live picture; full
  step-through is a bigger investment.

## How to influence the roadmap

Open an issue, or — if you're already using Mono for something —
send a note describing the use case. Real use cases beat feature
requests.
