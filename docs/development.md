# Development

## Scripts

| Command            | What it does                                       |
| ------------------ | -------------------------------------------------- |
| `npm run dev`      | Next.js dev server (HMR, fast refresh, errors in browser) |
| `npm run build`    | Production build (writes to `.next/`)              |
| `npm run start`    | Serve the production build                         |
| `npm run lint`     | ESLint, flat config, `core-web-vitals` + TS rules  |
| `npm run typecheck`| `tsc --noEmit`                                     |
| `npm run format`   | Prettier write (Tailwind classes sorted)           |

There is no test runner wired up. If you add one, add a `test`
script to `package.json` and document it here.

## Conventions

- **ESM**, no semicolons, double quotes, `trailingComma: "es5"`,
  `printWidth: 80` (matches `.prettierrc`).
- **Imports** use the `@/...` path alias. `@/*` resolves to the
  repo root. Do not use relative imports (`../foo`).
- **Client components** start with `"use client"` at the top of the
  file. Server components omit it.
- **shadcn primitives** are added with
  `npx shadcn@latest add <name>` — they land in `components/ui/`
  with the aliases declared in `components.json`.

## Keyboard shortcuts

Defined in `components/canvas.tsx` via
`useKeyboardShortcuts(...)`. The exact set:

| Shortcut          | Action                                   |
| ----------------- | ---------------------------------------- |
| `Ctrl/Cmd + Z`    | Undo                                     |
| `Ctrl/Cmd + Shift + Z` | Redo                                |
| `Ctrl/Cmd + C`    | Copy selected node                       |
| `Ctrl/Cmd + V`    | Paste node from clipboard                |
| `d`              | Toggle light / dark theme (global)       |

`d` is wired in `components/theme-provider.tsx`'s `<ThemeHotkey>`
child. The handler skips when typing in inputs, textareas, or
contenteditable elements, and when modifier keys are held.

## Working with the data

- **Reset a workflow:** delete `data/<id>.json` and reload.
- **Inspect a saved snapshot:** they're plain JSON; open in your
  editor of choice.
- **Seed a default workflow:** copy a JSON file into `data/<id>.json`
  and load `/<id>/workflow`.

## File structure cheatsheet

```
app/                 Next.js App Router
  layout.tsx         Root layout (server)
  page.tsx           "/" → "/default/workflow" (server)
  [id]/workflow/     The editor (server → client Canvas)
  api/...            Route handlers (Node runtime by default)

components/          App-level React components
  ui/                shadcn primitives (DO NOT edit by hand)
  nodes/             Node renderers + NODE_CATALOG

lib/                 Plain TypeScript modules, no React imports
hooks/               Reserved for future custom hooks (currently empty)
public/              Static assets served at "/"
data/                Per-workflow JSON snapshots (git-ignored)
```

## Common pitfalls

- **Tailwind v4 strips `--xy-*` variables from `globals.css`.** If
  you add a new React Flow variable, append it to
  `reactFlowThemeStyle` in `components/canvas.tsx`, not
  `globals.css`. See [architecture.md](./architecture.md#react-flow-theming).
- **`dark:` variant doesn't work.** The dark mode selector is
  `[data-theme="dark"]`, not `.dark`. Use shadcn tokens
  (`bg-background`, `text-foreground`, `border-border`) which switch
  automatically.
- **`params` is a Promise.** In Next.js 15+, both pages and route
  handlers receive `params: Promise<{ ... }>`. `await` it before
  reading. See `app/[id]/workflow/page.tsx`.
- **Adding a node type.** Don't forget to (1) add the renderer to
  `nodeTypesFor(...)` in `canvas.tsx`, (2) add the executor in
  `lib/execute-workflow.ts`. Adding it to `NODE_CATALOG` alone makes
  it appear in the picker but it won't render or run. Full walkthrough
  in [nodes.md](./nodes.md).

## Troubleshooting

- **Workflows won't save.** Check that the process has write access
  to the `data/` directory. The route creates it on demand.
- **`tsc` complains about React Flow types.** The package types are
  in `@xyflow/react`. If you import a sub-path (`@xyflow/react/dist/...`),
  prefer importing the types from the package root.
- **History panel out of sync.** The history stack is a snapshot
  of `nodes` and `edges` at a moment in time; closing the browser
  loses it (it's in-memory only). Persisted history (the `Save`
  button) is the source of truth across reloads.
- **agentation toolbar missing.** It only renders when
  `process.env.NODE_ENV === "development"`. In a production build
  it returns `null`.

## Before opening a PR

1. `npm run typecheck` — must be clean.
2. `npm run lint` — must be clean.
3. `npm run format` — runs Prettier; commit the result.
4. Manually exercise the affected flow in `npm run dev`.
5. If you changed the storage or API shape, update [api.md](./api.md)
   and [architecture.md](./architecture.md).
