# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

A visual workflow editor built on Next.js 16 (App Router) and React 19, scaffolded with `shadcn/ui` (style: `radix-luma`, base color: `mist`, icon library: `@tabler/icons-react`). TypeScript strict, Tailwind v4, ESM (`"type": "module"`). The canvas surface is React Flow (`@xyflow/react` v12); user-authored workflows (a graph of `Trigger` and `Request` nodes plus connecting edges) are persisted to disk and executed by a streaming API.

## Commands

All commands run from the repo root:

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, using `eslint-config-next/core-web-vitals` and `.../typescript`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run format` — Prettier write across `**/*.{ts,tsx}` (`prettier-plugin-tailwindcss` for class sorting)

There is no test runner wired up — no `test` script in `package.json`.

## Architecture

```
app/
  layout.tsx                       Root layout, mounts <ThemeProvider> + <AgentationToolbar>
  page.tsx                         Redirects "/" → "/default/workflow"
  globals.css                      Tailwind v4 + design tokens (oklch) + @theme inline
  [id]/workflow/page.tsx           The editor — renders <Canvas workflowId={id} />
  api/workflow/[id]/route.ts       GET/POST file-backed workflow snapshots (data/<id>.json)
  api/execute-workflow/route.ts    POST, streams NDJSON execution steps for a node graph

components/
  canvas.tsx                       React Flow surface, history (undo/redo), keyboard shortcuts
  sidebar.tsx                      Save/load/add-node controls + history list
  inspector.tsx                    Right-side drawer that edits the selected node's data
  history-panel.tsx                History list with restore / preview / delete / download
  create-node-dialog.tsx           Picker driven by NODE_CATALOG
  body-editor.tsx, auth-editor.tsx, input-data-editor.tsx,
  key-value-editor.tsx, json-editor.tsx, json-viewer.tsx,
  text-editor.tsx, log-viewer.tsx   Field-type editors for the inspector and dialog forms
  nodes/
    types.ts                       NodeData union, NodeDefinition, NODE_CATALOG (single source of truth)
    trigger-node.tsx, request-node.tsx   Node renderers (passed through canvas wrappers)
    node-label.tsx                 Shared node header
  theme-provider.tsx               next-themes wrapper + <ThemeHotkey> ("d" toggles light/dark)
  agentation.tsx                   Dev-only AI-feedback overlay (returns null in production)
  ui/                              shadcn primitives — `npx shadcn@latest add <name>` adds here

lib/
  execute-workflow.ts              Async generator that walks the graph, runs Request nodes,
                                   resolves {{NodeLabel.path}} expressions from prior results
  expression-path.ts               Resolves dot/bracket paths (e.g. `body[0].id`)
  execution-status.ts              Per-node execution status type
  use-keyboard-shortcuts.ts        "Stable listener, fresh state" hook (ref indirection)
  utils.ts                         cn() = twMerge(clsx(inputs))

hooks/                             Empty (placeholder .gitkeep) — no custom hooks live here yet
```

### Data flow

1. The user loads `/<id>/workflow`. `app/[id]/workflow/page.tsx` awaits `params` (Promise in Next.js 15+) and renders `<Canvas workflowId={id} />`.
2. `Canvas` mounts the React Flow surface and **on mount GETs `/api/workflow/<id>`** for the saved snapshot. If absent, it seeds `initialNodes`/`initialEdges` (one Trigger + one Request wired together).
3. Edits flow through React Flow's change handlers. The canvas keeps a JSON-stringified `lastSavedSnapshot`; `hasChanges = currentJson !== lastSaved` drives the Save button's "dirty" state. Save POSTs the current graph back to the same route.
4. A separate `POST /api/execute-workflow` accepts `{ nodes, edges, startId }` and **streams an NDJSON response**, one line per execution step (`controller.enqueue(JSON.stringify(step) + "\n")`). The Canvas consumes this for the live node status indicators.
5. Snapshots persist to `data/<id>.json` — the directory is git-ignored (see `.gitignore`), so each environment has its own saved state. The id is sanitized to `[a-zA-Z0-9_-]` before being used as a filename. For multi-replica production, swap this for a real database; the route shape is the only client contract.

### Node system: the `NODE_CATALOG` is the source of truth

`components/nodes/types.ts` exports `NODE_CATALOG: NodeDefinition[]`. Each entry describes a kind of node the user can add (key, type, label, description, icon, `fields: NodeField[]`). The picker (`create-node-dialog.tsx`), the inline form when creating, and the `inspector` all read from this list — so **adding a new node type is just appending a `NodeDefinition`**. The `fields` array drives the form; `key` is also used for dedup (`UNIQUE_CATALOG_KEYS` is a set of catalog keys the canvas treats as "at most one allowed", e.g. `trigger-manual`).

`NodeData` is the union of all per-type data shapes. New fields on a node's data use a string `key` rather than extending the union, so the create dialog and inspector don't need to be touched when you add a field.

### Expression resolution

Any string field of a `RequestNode` may contain `{{NodeLabel.path}}` placeholders. `lib/execute-workflow.ts::resolveExpressions` substitutes them with values from the `nodeResults` map produced by prior nodes in the run. Path resolution is delegated to `lib/expression-path.ts` and accepts both dot and bracket notation (`Request.body[0].id`). Unresolved expressions are left untouched so the user can see what's missing.

## React Flow theming via shadcn tokens

`components/canvas.tsx` carries an inline `reactFlowThemeStyle` that maps every `--xy-*` user-facing variable React Flow reads (canvas background, grid, edges, handles, selection, minimap, controls, attribution) to the shadcn tokens in `app/globals.css` (`--background`, `--card`, `--muted-foreground`, `--primary`, etc.). The tokens themselves switch with `[data-theme="dark"]`, so the RF surface follows light/dark mode without duplication.

**Why inline, not `:root` in `globals.css`.** A `:root { --xy-* }` block in `globals.css` was being stripped at build time by Tailwind v4's content-aware CSS tree-shake: the only references to those variables live in `node_modules/@xyflow/react/dist/style.css`, which Tailwind doesn't scan, so it concluded the declarations were unused. Inline `style` bypasses that pass. If you add a new RF variable later, append it to `reactFlowThemeStyle` in `components/canvas.tsx`, not to `globals.css`.

## Styling & Theming

Tailwind v4 is configured via PostCSS (`postcss.config.mjs` uses `@tailwindcss/postcss`), not via a `tailwind.config.*` file. The full design-token system (colors, radii, fonts, sidebar/chart tokens, light + `[data-theme="dark"]`) lives as CSS custom properties in `app/globals.css` under `@theme inline { … }`, with `:root` / `[data-theme="dark"]` oklch values. New design tokens should be added there, not in a JS config.

The `@layer base` block applies `border-border outline-ring/50` to `*`, `bg-background text-foreground` to `body`, and `font-sans` to `html`. Note that the dark variant is keyed off `[data-theme="dark"] *`, not `.dark` — `next-themes` toggles `data-theme`, not the `dark` class, so the standard shadcn `dark:` variant would not work here.

Prettier sorts Tailwind classes via `prettier-plugin-tailwindcss`, scoped to `app/globals.css` and the `cn`/`cva` helpers.

## ESLint

`eslint.config.mjs` uses the new flat-config format (`defineConfig` + `globalIgnores`). It extends `eslint-config-next/core-web-vitals` and `.../typescript`, then explicitly allows linting of `.next/**`, `out/**`, `build/**`, and `next-env.d.ts` (the last overrides the default ignore).

## Conventions Specific to This Repo

- Module type is ESM and Prettier uses no semicolons (`semi: false`), double quotes, `trailingComma: "es5"`, `printWidth: 80`. Match these when adding files.
- Imports use the `@/...` path alias; relative imports are not used.
- Client components must start with `"use client"` (see `components/theme-provider.tsx`). `app/layout.tsx`, `app/page.tsx`, and `app/[id]/workflow/page.tsx` are server components.
- Before any Next.js code change, follow the rule in `AGENTS.md` and check the bundled version-matched docs at `node_modules/next/dist/docs/` (e.g. `01-app/02-guides/instant-navigation.md` for the `unstable_instant` route export, `01-app/02-guides/ai-agents.md` for details on the AGENTS.md / CLAUDE.md wiring). The version here (`next@16.2.10`) has breaking changes vs. earlier Next.js — `params` is a `Promise` and must be awaited in route handlers and page components.
- `data/` is git-ignored — workflow snapshots are local-only. Don't commit them.
