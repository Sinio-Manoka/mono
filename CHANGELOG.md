# Changelog

All notable changes to Mono are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/)
once 1.0 ships.

## [Unreleased]

### Added
- Initial documentation set: README, LICENSE, CONTRIBUTING,
  docs/ (architecture, getting started, development, nodes,
  expressions, api, roadmap).
- AGPL-3.0 license.
- `.github/` issue and PR templates.

## [0.0.1] — 2026-07-03

Initial scaffold. The shape of the project as of this release:

### Added
- Next.js 16 (App Router) + React 19 + TypeScript strict.
- Tailwind v4 with shadcn/ui (`radix-luma`, `mist` base,
  `@tabler/icons-react`).
- React Flow v12 canvas with shadcn-token theming.
- Visual workflow editor with manual triggers, HTTP request
  nodes, and `{{NodeLabel.path}}` expression resolution.
- Streaming execution API (`POST /api/execute-workflow`,
  NDJSON).
- File-backed workflow storage (`GET`/`POST /api/workflow/<id>`,
  one JSON file per id under `data/`).
- Undo / redo with a visual history panel (restore, preview,
  delete, download).
- Keyboard shortcuts for undo, redo, copy, paste.
- Save / Load / Import / Export.
- Light / dark theme with a `d` hotkey to toggle.
- agentation dev toolbar (no-op in production builds).
- Theme provider wrapping `next-themes`.
