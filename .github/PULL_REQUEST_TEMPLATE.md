## What

A one-paragraph description of the change. If it fixes a bug,
say what was broken. If it adds a feature, say what it does.

## Why

The use case. Link the issue if there is one (use `Closes #123`
or `Fixes #123` so GitHub auto-closes it on merge).

## How

Anything a reviewer should know before reading the diff:

- New files added and why.
- Tradeoffs you made.
- Out-of-scope things you considered but didn't do.

## Testing

What you did to verify it works:

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run format` run
- [ ] Manually exercised the affected flow in `npm run dev`

For visual changes, attach before / after screenshots. For
executor changes, include the workflow JSON you tested with.

## Docs

- [ ] Updated [docs/api.md](docs/api.md) (if HTTP API changed)
- [ ] Updated [docs/architecture.md](docs/architecture.md) (if structure changed)
- [ ] Updated [README.md](README.md) (if headline behavior changed)
- [ ] No docs update needed

## License

- [ ] I agree my contribution is licensed under the
  [AGPL-3.0](LICENSE).
