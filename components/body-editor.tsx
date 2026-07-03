"use client"

import { useState } from "react"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { JsonEditor } from "@/components/json-editor"

type BodyType = "raw" | "form-data" | "form-urlencoded" | "graphql"

type GraphqlData = { query: string; variables?: string }

type BodyData = {
  type: BodyType
  raw?: string
  formData?: Array<{ key: string; value: string }>
  graphql?: GraphqlData
}

type BodyEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function BodyEditor({ value, onChange }: BodyEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [bodyData, setBodyData] = useState<BodyData>(() => {
    try {
      return value ? JSON.parse(value) : { type: "raw", raw: "" }
    } catch {
      return { type: "raw", raw: value || "" }
    }
  })

  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const handleSave = () => {
    onChange(JSON.stringify(bodyData))
    setIsOpen(false)
  }

  const handleCancel = () => {
    setIsOpen(false)
  }

  const getDisplayText = () => {
    switch (bodyData.type) {
      case "form-data":
        return `Form Data (${bodyData.formData?.length || 0} fields)`
      case "form-urlencoded":
        return "URL Encoded"
      case "graphql":
        return "GraphQL"
      default:
        return bodyData.raw ? `${bodyData.raw.length} chars` : "empty"
    }
  }

  const handleAddFormField = () => {
    if (newKey.trim()) {
      setBodyData((prev) => ({
        ...prev,
        formData: [...(prev.formData || []), { key: newKey.trim(), value: newValue }],
      }))
      setNewKey("")
      setNewValue("")
    }
  }

  const handleRemoveFormField = (index: number) => {
    setBodyData((prev) => ({
      ...prev,
      formData: prev.formData?.filter((_, i) => i !== index) || [],
    }))
  }

  const handleUpdateFormField = (index: number, key: string, val: string) => {
    setBodyData((prev) => {
      const updated = [...(prev.formData || [])]
      updated[index] = { key, value: val }
      return { ...prev, formData: updated }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" style={{ borderRadius: "10px" }}>
          <span>Body</span>
          <span className="text-xs text-muted-foreground">{getDisplayText()}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-4xl !w-[95vw] !h-[80vh] flex flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ backgroundColor: "#171B1F" }}>
          <div>
            <DialogTitle className="text-base">Body</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Configure request body content</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-4 min-h-[300px]" style={{ backgroundColor: "#171B1F" }}>
          {/* Body Type Selection */}
          <div className="flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Type</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["raw", "form-data", "form-urlencoded", "graphql"] as BodyType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={bodyData.type === type ? "default" : "outline"}
                  onClick={() => setBodyData({ ...bodyData, type })}
                  className="capitalize text-xs"
                  size="sm"
                >
                  {type === "form-data" ? "Form Data" : type === "form-urlencoded" ? "URL Encoded" : type === "graphql" ? "GraphQL" : "Raw"}
                </Button>
              ))}
            </div>
          </div>

          {/* Raw Editor */}
          {bodyData.type === "raw" && (
            <JsonEditor
              value={bodyData.raw || ""}
              onChange={(val) => setBodyData({ ...bodyData, raw: val })}
              placeholder='{"key": "value"}'
              className="flex-1"
            />
          )}

          {/* GraphQL Editor */}
          {bodyData.type === "graphql" && (
            <div className="flex-1 flex flex-col overflow-hidden gap-3">
              <div className="flex-1 flex flex-col overflow-hidden">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Query</p>
                <div className="flex-1 overflow-hidden border border-border bg-background" style={{ borderRadius: "10px" }}>
                  <textarea
                    value={bodyData.graphql?.query || ""}
                    onChange={(e) =>
                      setBodyData({
                        ...bodyData,
                        graphql: {
                          query: e.target.value,
                          variables: bodyData.graphql?.variables,
                        },
                      })
                    }
                    placeholder="query { ... }"
                    className="w-full h-full p-4 text-sm font-mono text-foreground resize-none overflow-auto outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Variables (JSON)</p>
                <JsonEditor
                  value={bodyData.graphql?.variables || ""}
                  onChange={(val) =>
                    setBodyData({
                      ...bodyData,
                      graphql: {
                        query: bodyData.graphql?.query ?? "",
                        variables: val,
                      },
                    })
                  }
                  placeholder='{"key": "value"}'
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {/* Form Data & URL Encoded */}
          {(bodyData.type === "form-data" || bodyData.type === "form-urlencoded") && (
            <div className="flex-1 flex flex-col overflow-hidden gap-3">
              {/* Existing pairs */}
              {(bodyData.formData || []).length > 0 && (
                <div className="flex-1 overflow-y-auto border bg-muted/30" style={{ borderRadius: "10px" }}>
                  <div className="divide-y">
                    {(bodyData.formData || []).map((pair, index) => (
                      <div key={index} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={pair.key}
                            onChange={(e) => handleUpdateFormField(index, e.target.value, pair.value)}
                            placeholder="Key"
                            className="flex-1 px-2 py-1 border text-sm bg-background"
                            style={{ borderRadius: "10px" }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFormField(index)}
                            className="px-2 h-auto py-1"
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </div>
                        <input
                          type="text"
                          value={pair.value}
                          onChange={(e) => handleUpdateFormField(index, pair.key, e.target.value)}
                          placeholder="Value"
                          className="w-full px-2 py-1 border text-sm bg-background"
                          style={{ borderRadius: "10px" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add new field */}
              <div className="flex-shrink-0 border p-3 space-y-2 bg-muted/30" style={{ borderRadius: "10px" }}>
                <p className="text-xs font-semibold text-muted-foreground">Add Field</p>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFormField()}
                  placeholder="Key"
                  className="w-full px-2 py-1.5 border text-sm bg-background"
                  style={{ borderRadius: "10px" }}
                />
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFormField()}
                  placeholder="Value"
                  className="w-full px-2 py-1.5 border text-sm bg-background"
                  style={{ borderRadius: "10px" }}
                />
                <Button type="button" onClick={handleAddFormField} className="w-full" size="sm">
                  <IconPlus className="size-4 mr-1" />
                  Add Field
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with buttons */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0" style={{ backgroundColor: "#171B1F" }}>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
