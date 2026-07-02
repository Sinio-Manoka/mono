# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Next.js 16 (App Router) template scaffolded with `shadcn/ui` (style: `radix-luma`, base color: `mist`, icon library: `@tabler/icons-react`). React 19, TypeScript strict, Tailwind v4, ESM (`"type": "module"`).

## Commands

All commands run from the repo root:

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, using `eslint-config-next/core-web-vitals` and `.../typescript`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run format` — Prettier write across `**/*.{ts,tsx}` (`prettier-plugin-tailwindcss` for class sorting)

There is no test runner wired up — no `test` script in `package.json`.

## Architecture & Structure

App Router lives under `app/` (`layout.tsx`, `page.tsx`, `globals.css`). `app/layout.tsx` mounts `<ThemeProvider>` from `@/components/theme-provider` and applies Geist Mono (`--font-mono`), Noto Sans (`--font-sans`), and `font-sans` to the `<html>`. `suppressHydrationWarning` is required because `next-themes` toggles `class` on `<html>` at runtime.

Path alias `@/*` maps to the repo root (see `tsconfig.json`), so `@/components/ui/button` resolves to `components/ui/button.tsx` and `@/lib/utils` to `lib/utils.ts`.

`components/` holds app-level components. The `components/theme-provider.tsx` wrapper around `next-themes` adds a `<ThemeHotkey>` child component that listens for the `d` key (skipping when typing in inputs/textareas/contenteditable or when modifier keys are held) to toggle light/dark.

`components/agentation.tsx` mounts the [`agentation`](https://www.agentation.com) dev toolbar (visual feedback overlay for AI agents) via `<Agentation />`. It is a `"use client"` component that returns `null` when `process.env.NODE_ENV !== "development"`, so it ships nothing in production builds. Mounted once in `app/layout.tsx` alongside `<ThemeProvider>`. To pipe annotations into an agent, run `npx agentation-mcp init` and pass an `endpoint` (default `http://localhost:4747`) to `<Agentation />`.

`components/ui/` holds shadcn primitives added via `npx shadcn@latest add <name>`. The default scaffold includes `button.tsx` (uses `cva` for variants + sizes, `radix-ui` `Slot.Root` when `asChild`, exposes `buttonVariants`, sets `data-slot="button"`, `data-variant`, `data-size`).

`components/canvas.tsx` is a `"use client"` empty React Flow surface (uses [`@xyflow/react`](https://reactflow.dev)). It wraps a `<ReactFlowProvider>` around a `<ReactFlow>` with `nodes={[]}` and `edges={[]}`, plus the `<Background />`, `<Controls />`, and `<MiniMap />` slots, sized via `h-svh w-full` so it fills the viewport. The package stylesheet (`@xyflow/react/dist/style.css`) is imported inside this client component — that is the supported way in v12. The component is mounted as the home page (`app/page.tsx` is a one-liner that renders `<Canvas />`).

**React Flow theming via shadcn tokens.** The wrapper div carries an inline `style` (`reactFlowThemeStyle` at the top of `components/canvas.tsx`) that maps every `--xy-*` user-facing variable React Flow reads (canvas background, grid, edges, handles, selection, minimap, controls, attribution) to the shadcn tokens defined in `app/globals.css` (`--background`, `--card`, `--muted-foreground`, `--primary`, etc.). The tokens themselves switch with `[data-theme="dark"]`, so the RF surface follows light/dark mode without duplication.

**Why inline, not `:root` in `globals.css`.** A `:root { --xy-* }` block in `globals.css` was being stripped at build time by Tailwind v4's content-aware CSS tree-shake: the only references to those variables live in `node_modules/@xyflow/react/dist/style.css`, which Tailwind doesn't scan, so it concluded the declarations were unused. Inline `style` bypasses that pass and is the only way to keep the variables in the cascade without re-declaring every shadcn token locally. If you add a new RF variable later, append it to `reactFlowThemeStyle` in `components/canvas.tsx`, not to `globals.css`.

`lib/utils.ts` exports `cn(...inputs)` — `twMerge(clsx(inputs))`. This is the canonical class-name helper referenced by `components.json` (`aliases.utils`) and formatted by Prettier via the `cn`/`cva` Tailwind functions list.

`hooks/` is empty (placeholder `.gitkeep`).

`components.json` is the shadcn config — additions come from running the shadcn CLI; new ui primitives land in `components/ui/` using these aliases: `components: @/components`, `ui: @/components/ui`, `utils: @/lib/utils`, `lib: @/lib`, `hooks: @/hooks`.

## Styling & Theming

Tailwind v4 is configured via PostCSS (`postcss.config.mjs` uses `@tailwindcss/postcss`), not via a `tailwind.config.*` file. The full design-token system (colors, radii, fonts, sidebar/chart tokens, light + `.dark`) lives as CSS custom properties in `app/globals.css` under `@theme inline { … }`, with `:root` / `.dark` oklch values. New design tokens should be added there, not in a JS config.

The `@layer base` block applies `border-border outline-ring/50` to `*`, `bg-background text-foreground` to `body`, and `font-sans` to `html`.

Prettier sorts Tailwind classes via `prettier-plugin-tailwindcss`, scoped to `app/globals.css` and the `cn`/`cva` helpers.

## ESLint

`eslint.config.mjs` uses the new flat-config format (`defineConfig` + `globalIgnores`). It extends `eslint-config-next/core-web-vitals` and `.../typescript`, then explicitly allows linting of `.next/**`, `out/**`, `build/**`, and `next-env.d.ts` (the last overrides the default ignore).

## Conventions Specific to This Repo

- Module type is ESM and Prettier uses no semicolons (`semi: false`), double quotes, `trailingComma: "es5"`, `printWidth: 80`. Match these when adding files.
- Imports use the `@/...` path alias; relative imports are not used.
- Client components must start with `"use client"` (see `components/theme-provider.tsx`). `app/layout.tsx` and `app/page.tsx` are server components by default.
- Before any Next.js code change, follow the rule in `AGENTS.md` and check the bundled version-matched docs at `node_modules/next/dist/docs/` (e.g. `01-app/02-guides/instant-navigation.md` for the `unstable_instant` route export, `01-app/02-guides/ai-agents.md` for details on the AGENTS.md / CLAUDE.md wiring). The version here (`next@16.2.6`) has breaking changes vs. earlier Next.js.
