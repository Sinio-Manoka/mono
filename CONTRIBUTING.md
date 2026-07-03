# Contributing

Thanks for your interest in Mono! Bug reports, feature requests,
docs improvements, and pull requests are all welcome.

This project is open to contributors. Mono is licensed under the
[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0) — by
submitting a contribution you agree to license it under the same
terms.

## Ground rules

- **Be respectful.** Disagree on ideas, not on people.
- **Small PRs land faster.** A focused change is easier to review
  and less likely to conflict with the next person's work.
- **Match the existing code style.** Run `npm run format` and
  `npm run lint` before pushing.
- **Don't commit secrets, snapshots, or build artifacts.** The
  `data/` directory and `.next/` are git-ignored for a reason.

## Filing issues

Use the [bug report](../../.github/ISSUE_TEMPLATE/bug_report.md)
or [feature request](../../.github/ISSUE_TEMPLATE/feature_request.md)
template. They capture the information needed to act on the
issue without a back-and-forth.

Good bug reports include:

- A minimal repro (the smallest workflow that triggers the bug).
- What you expected vs. what happened.
- Browser, OS, and Node version.
- Console errors (full stack trace, not just the message).

Good feature requests include:

- The use case, not just the solution. ("I need X because Y" beats
  "add X".)
- Alternatives you considered.
- Whether you'd be willing to send a PR.

## Development setup

```bash
# Fork & clone
git clone https://github.com/<you>/mono.git
cd mono
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The
first load redirects to `/default/workflow`, the starter canvas.

## Pull request workflow

1. **Branch from `master`.** Use a descriptive name:
   `feat/node-delay`, `fix/expression-array-index`, etc.
2. **Make your change.** Keep commits small and message them
   clearly. The conventional commit prefixes (`feat:`, `fix:`,
   `docs:`, `chore:`, `refactor:`) match what's already in the
   git log.
3. **Run the checks** — see [docs/development.md](docs/development.md#before-opening-a-pr):
   ```bash
   npm run typecheck
   npm run lint
   npm run format
   ```
4. **Exercise the change manually** in `npm run dev`. If you
   touched a route, hit it from the browser; if you touched the
   executor, run a workflow.
5. **Update docs** if you changed user-facing behavior. At a
   minimum, [docs/api.md](docs/api.md) for HTTP API changes,
   [docs/architecture.md](docs/architecture.md) for structural
   changes, and [README.md](README.md) for headline features.
6. **Open the PR** using the
   [PR template](../../.github/PULL_REQUEST_TEMPLATE.md). Reference
   the issue it closes with `Closes #123`.

## Where to start

If you're new to the codebase, the issues labeled
`good first issue` are picked to be self-contained. Some
specific areas that could use help:

- **New node types.** The walkthrough in
  [docs/nodes.md](docs/nodes.md) is the spec — pick a node from
  the [roadmap](docs/roadmap.md#now-pre-10) and build it.
- **Expression language improvements.** `lib/expression-path.ts`
  is the resolver. Things it doesn't currently support:
  negative array indices, escaped quotes inside bracket notation,
  a `{{env.VAR}}` form for environment variables. Each is a
  small, contained change.
- **Documentation.** If you got stuck on something, write down
  what unblocked you — chances are the next person will hit the
  same wall.

## Code review

PRs are reviewed on correctness, fit with the existing patterns,
and clarity. Reviewers may push back on naming, structure, or
missing tests; that's normal and not a sign your work is bad.
If you disagree with feedback, say so — explain your reasoning
and the reviewer can change their mind or explain theirs.

## Releases

Releases follow semver. `0.x.y` is the current line; the
1.0 milestone is in [docs/roadmap.md](docs/roadmap.md). Until
1.0, anything may shift.

## License reminder

By submitting a contribution, you agree your contribution is
licensed under the [AGPL-3.0](LICENSE). If you're contributing on
behalf of an employer, make sure their IP policy allows it —
AGPL-3.0 is a copyleft license, which most companies accept but
some have policies against.
