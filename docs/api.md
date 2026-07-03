# API reference

The HTTP API is small on purpose: two route handlers in `app/api/`
that the editor talks to, plus an "On Request" trigger endpoint
that will be added as part of the SaaS work (see
[roadmap.md](./roadmap.md)).

Base URL: `http://localhost:3000` in development, your deployment
URL in production.

## `GET /api/workflow/{id}`

Load a saved workflow snapshot.

**Path params**

- `id` — workflow id. Sanitized server-side to `[a-zA-Z0-9_-]`. An
  empty or invalid id is treated as `"default"`.

**Response — 200**

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 0, "y": 0 },
      "data": { "label": "On Request", "triggerType": "request" }
    }
  ],
  "edges": []
}
```

**Response — 200 (no saved workflow)**

Same shape, but `nodes` and `edges` are empty arrays. The client
treats this as "no snapshot yet" and seeds defaults.

**Errors**

This route does not return 4xx — missing or corrupt files both
result in the empty-snapshot response. The `data/` directory is
created on demand by the POST handler.

## `POST /api/workflow/{id}`

Save (replace) a workflow snapshot.

**Path params**

- `id` — same sanitization as `GET`.

**Request body**

```json
{
  "nodes": [ { "id": "trigger-1", "type": "trigger", "position": { "x": 0, "y": 0 }, "data": { ... } } ],
  "edges": [ { "id": "e1", "source": "trigger-1", "target": "request-1" } ]
}
```

Both `nodes` and `edges` must be arrays.

**Response — 200**

```json
{ "ok": true }
```

**Response — 400 (bad body)**

```json
{ "error": "Body must be { nodes: Node[]; edges: Edge[] }" }
```

or

```json
{ "error": "Invalid JSON body" }
```

**Persistence**

The snapshot is written to `data/<safe-id>.json` in the
deployment's working directory. For multi-replica deployments
this is a problem — see [architecture.md](./architecture.md#storage)
for the swap point.

## `POST /api/execute-workflow`

Run a workflow. Streams the execution as NDJSON.

**Request body**

```json
{
  "nodes": [ ... ],
  "edges": [ ... ],
  "startId": "trigger-1"
}
```

`startId` is the id of the node to begin from. For the
Manual trigger, this is the trigger's id; for On Request, the
incoming HTTP request seeds the start.

**Response — 200**

`Content-Type: application/x-ndjson`, `Transfer-Encoding: chunked`.

The body is a stream of newline-delimited JSON, one event per
line. Each event is one of:

```json
{ "type": "start",   "nodeId": "trigger-1" }
{ "type": "success", "nodeId": "trigger-1", "result": { ... } }
{ "type": "error",   "nodeId": "request-1", "error": "Request failed: ..." }
```

`result` is whatever the executor returned. For a Request node
that's `{ status, statusText, ok, input, body }`. For a Trigger
node it's `{ type, startedAt, input }`. For an On Request trigger
it's the incoming request envelope.

**Response — 400 (bad body)**

```json
{ "error": "..." }
```

A bad body short-circuits before streaming starts. Once the
stream is open, errors are surfaced as in-band `{ "type": "error" }`
events — the stream always closes cleanly.

**Client usage**

```ts
const res = await fetch("/api/execute-workflow", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nodes, edges, startId }),
})

const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ""
while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  for (;;) {
    const nl = buffer.indexOf("\n")
    if (nl === -1) break
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    const event = JSON.parse(line)
    // ... handle start / success / error
  }
}
```

## Future endpoints

These are not implemented yet but planned:

- `POST /api/trigger/{id}` — fire a workflow that starts with
  an "On Request" trigger. The body becomes the trigger's
  `input`, and the response is the same NDJSON stream.
- `GET /api/workflows` — list saved workflows (id + last
  modified time). Powers a workflow picker.
- `GET /api/health` — liveness probe for hosted deployments.
