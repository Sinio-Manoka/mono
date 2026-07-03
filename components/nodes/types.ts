/**
 * Per-node-type data shapes. The Canvas stores its `nodes` state as
 * `Node<NodeData>[]`, where `NodeData` is the union of every type's data.
 * The Inspector narrows on `node.type` to decide which fields to render.
 */

import { IconApi, IconBolt, IconWorld, type Icon } from "@tabler/icons-react"

export type TriggerNodeData = {
  label?: string
  /** What kind of trigger this is — "manual" fires from a button, "request" from an incoming HTTP call. */
  triggerType?: "manual" | "request"
  /** Input data to pass to the workflow (JSON string). */
  inputData?: string
}

export type RequestNodeData = {
  label?: string
  /** HTTP method. Free-form string so we can extend past the common four. */
  method?: string
  /** Target URL. */
  url?: string
  /** Query parameters as JSON object. */
  queryParams?: string
  /** Request headers as JSON object. */
  headers?: string
  /** Request body/payload (for POST/PUT/PATCH). */
  body?: string
  /** Authorization header (Bearer token). */
  authToken?: string
}

export type NodeData = TriggerNodeData | RequestNodeData

export type NodeType = "trigger" | "request"

export function isNodeType(value: string | undefined): value is NodeType {
  return value === "trigger" || value === "request"
}

/* ---------------------------------------------------------------------------
 * NodeDefinition — the declarative shape for "how to create a node".
 *
 * Each entry in `NODE_CATALOG` describes a kind of node the user can add.
 * The `fields` array drives the inline config form in the CreateNodeDialog
 * and (mirrored) the Inspector — so the picker, the form, and the per-node
 * editor all stay in sync from a single source of truth.
 *
 * Adding a new node type is just appending a `NodeDefinition` to
 * `NODE_CATALOG`; the rest of the system (picker, form, dedup, Inspector)
 * picks it up automatically.
 * ------------------------------------------------------------------------- */

export type NodeFieldType = "text" | "select"

export type NodeField = {
  /** Key in `NodeData` this field writes to. Free-form for now so we can
   *  add new fields without changing the union, but the create dialog and
   *  Inspector both treat it as a string property of the merged data. */
  key: string
  label: string
  type: NodeFieldType
  placeholder?: string
  /** Pre-filled when the user picks this node from the picker. */
  defaultValue?: string
  /** Options for `type: "select"`. */
  options?: ReadonlyArray<{ value: string; label: string }>
}

export type NodeDefinition = {
  /** Stable identifier, independent of `label`. Used for dedup and `disabledKeys`. */
  key: string
  type: NodeType
  label: string
  description: string
  icon: Icon
  fields: NodeField[]
}

export const NODE_CATALOG: NodeDefinition[] = [
  {
    key: "trigger-manual",
    type: "trigger",
    label: "Manuell",
    description: "Startet den Workflow manuell per Knopf.",
    icon: IconBolt,
    fields: [
      { key: "label", label: "Label", type: "text", defaultValue: "Manuell" },
    ],
  },
  {
    key: "trigger-request",
    type: "trigger",
    label: "On Request",
    description: "Startet bei eingehendem HTTP-Request.",
    icon: IconWorld,
    fields: [
      {
        key: "label",
        label: "Label",
        type: "text",
        defaultValue: "On Request",
      },
    ],
  },
  {
    key: "request",
    type: "request",
    label: "Request",
    description: "Sendet einen HTTP-Request und nutzt die Antwort.",
    icon: IconApi,
    fields: [
      { key: "label", label: "Label", type: "text", defaultValue: "Request" },
      {
        key: "method",
        label: "Method",
        type: "select",
        defaultValue: "GET",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "DELETE", label: "DELETE" },
          { value: "PATCH", label: "PATCH" },
          { value: "HEAD", label: "HEAD" },
          { value: "OPTIONS", label: "OPTIONS" },
        ],
      },
      {
        key: "url",
        label: "URL",
        type: "text",
        placeholder: "https://jsonplaceholder.typicode.com/posts",
        defaultValue: "https://jsonplaceholder.typicode.com/posts",
      },
      {
        key: "queryParams",
        label: "Query Parameters (JSON)",
        type: "text",
        placeholder: '{"key": "value"}',
      },
      {
        key: "headers",
        label: "Headers (JSON)",
        type: "text",
        placeholder: '{"Content-Type": "application/json"}',
        defaultValue: '{"Content-Type": "application/json"}',
      },
      {
        key: "authToken",
        label: "Bearer Token",
        type: "text",
        placeholder: "your-token-here",
      },
      {
        key: "body",
        label: "Body (JSON)",
        type: "text",
        placeholder: '{"title": "Test", "userId": 1}',
      },
    ],
  },
]

/** Catalog keys that the Canvas treats as "at most one allowed". */
export const UNIQUE_CATALOG_KEYS: ReadonlySet<string> = new Set([
  "trigger-manual",
])



