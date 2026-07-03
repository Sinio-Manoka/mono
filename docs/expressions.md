# Expressions

Any string field of a `Request` or `Trigger` node can contain
`{{...}}` template expressions. They're resolved at execution
time against the results produced by upstream nodes.

## Syntax

```
{{NodeLabel.path.to.value}}
{{NodeLabel.array[0].field}}
{{NodeLabel.body.items[2].name}}
```

Two parts:

- **NodeLabel** — the **label** of an upstream node, exactly as
  the user typed it in the Inspector. Labels are case-sensitive.
- **path** — a chain of dot-separated keys, bracket-indexed
  array positions, or both in any combination.

Examples:

| Expression                  | Resolves to                                  |
| --------------------------- | -------------------------------------------- |
| `{{Request.body.id}}`       | `results["Request"].body.id`                 |
| `{{Request.body[0].id}}`    | `results["Request"].body[0].id`              |
| `{{Request.items[2].name}}` | `results["Request"].items[2].name`           |
| `{{Trigger.input}}`         | `results["Trigger"].input`                   |

Bare `{{NodeLabel}}` (no path) is also valid — it resolves to the
whole result object, which is stringified as JSON for interpolation.

## Where you can use them

In any string field of a Request node:

- `url`
- `queryParams` (JSON)
- `headers` (JSON)
- `body` (JSON, depending on `type`)
- `authToken` (Bearer token)

And in a Trigger node's `inputData` field.

## How resolution works

1. As each node finishes, its result is stored in the executor's
   `nodeResults` map, keyed by the node's label.
2. Before the next node runs, every string field of its data is
   scanned for `{{...}}` patterns.
3. Each match is replaced with the resolved value (or left
   untouched if the path is unknown — see below).

Resolution is implemented in
`lib/execute-workflow.ts::resolveExpressions` and
`lib/expression-path.ts::resolvePath`.

## Failure modes (and what happens)

| Situation                              | Result                                   |
| -------------------------------------- | ---------------------------------------- |
| `{{UnknownLabel.x}}`                   | Expression left as-is (e.g. `{{UnknownLabel.x}}`) |
| `{{Request.unknownField}}`             | Expression left as-is                    |
| `{{Request.body[99]}}` (out of range)  | Expression left as-is                    |
| Resolved value is `null` or `undefined`| Expression left as-is                    |
| Resolved value is a number / boolean   | Coerced to string                        |
| Resolved value is an object            | Stringified via `JSON.stringify`         |

Unresolved expressions are intentionally left untouched so the
user can see what's missing. Check the executed value in the
Inspector — anything that still has `{{...}}` in it didn't
resolve.

## Quoting

If you need a literal `{{...}}` in a field (rare), there's no
escape syntax today. As a workaround, build the string in a
downstream node using a transform node (when one exists) or
hardcode it in the request body via JSON.

## Resolution order and timing

Expressions in node N are resolved against the results of nodes
that ran **before** N. They're not resolved until execution time,
so:

- You can change upstream nodes and the references stay valid.
- The Inspector cannot preview resolved values; it shows the raw
  template. To see the actual value, run the workflow and look at
  the executed result in the Inspector.

## Path resolution edge cases

`lib/expression-path.ts` accepts both `.` and `[`/`]` in the same
path, but **whichever notation the user types in the inspector
must round-trip identically through the executor** — there's no
normalization step. If the inspector says the path is valid, it
will resolve at run time; if the inspector says invalid, it will
fail at run time with the expression left as-is.

Specifically:

- `a.b.c` and `a["b"]["c"]` are equivalent in concept but only
  the first is supported today.
- `a[0]` works for array indices, but `a["0"]` does not (the
  bracket contents are passed to `Number()`).
- Negative indices (`a[-1]`) are rejected.

## A worked example

A workflow with two Requests:

```
Trigger "On Request"
   └── Request "Get User" (GET https://api.example.com/users/1)
         └── Request "Get Posts" (GET https://api.example.com/users/{{Get User.body.id}}/posts)
```

When the second Request runs, `nodeResults["Get User"]` holds
`{ status, statusText, ok, input, body: { id: 1, name: "...", ... } }`.
The URL field `https://api.example.com/users/{{Get User.body.id}}/posts`
becomes `https://api.example.com/users/1/posts` before the fetch.
