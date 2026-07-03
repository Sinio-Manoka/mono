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

type DataType = "json" | "text" | "form"

type InputData = {
  type: DataType
  json?: string
  text?: string
  form?: Array<{ key: string; value: string }>
}

type InputDataEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function InputDataEditor({ value, onChange }: InputDataEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputData, setInputData] = useState<InputData>(() => {
    try {
      return value ? JSON.parse(value) : { type: "json", json: "" }
    } catch {
      return { type: "json", json: value || "" }
    }
  })

  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const handleSave = () => {
    onChange(JSON.stringify(inputData))
    setIsOpen(false)
  }

  const handleCancel = () => {
    setIsOpen(false)
  }

  const getDisplayText = () => {
    switch (inputData.type) {
      case "form":
        return `Form (${inputData.form?.length || 0} fields)`
      case "text":
        return inputData.text ? `${inputData.text.length} chars` : "empty"
      default:
        return inputData.json ? `${inputData.json.length} chars` : "empty"
    }
  }

  const handleAddFormField = () => {
    if (newKey.trim()) {
      setInputData((prev) => ({
        ...prev,
        form: [...(prev.form || []), { key: newKey.trim(), value: newValue }],
      }))
      setNewKey("")
      setNewValue("")
    }
  }

  const handleRemoveFormField = (index: number) => {
    setInputData((prev) => ({
      ...prev,
      form: prev.form?.filter((_, i) => i !== index) || [],
    }))
  }

  const handleUpdateFormField = (index: number, key: string, val: string) => {
    setInputData((prev) => {
      const updated = [...(prev.form || [])]
      updated[index] = { key, value: val }
      return { ...prev, form: updated }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" style={{ borderRadius: "10px" }}>
          <span>Input Data</span>
          <span className="text-xs text-muted-foreground">{getDisplayText()}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-4xl !w-[95vw] !h-[80vh] flex flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ backgroundColor: "#171B1F" }}>
          <div>
            <DialogTitle className="text-base">Input Data</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Data to pass to the workflow</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-4 min-h-[300px]" style={{ backgroundColor: "#171B1F" }}>
          {/* Data Type Selection */}
          <div className="flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Type</p>
            <div className="grid grid-cols-3 gap-2">
              {(["json", "text", "form"] as DataType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={inputData.type === type ? "default" : "outline"}
                  onClick={() => setInputData({ ...inputData, type })}
                  className="capitalize text-xs"
                  size="sm"
                >
                  {type === "json" ? "JSON" : type === "form" ? "Key-Value" : "Text"}
                </Button>
              ))}
            </div>
          </div>

          {/* JSON Editor */}
          {inputData.type === "json" && (
            <JsonEditor
              value={inputData.json || ""}
              onChange={(val) => setInputData({ ...inputData, json: val })}
              placeholder='{"key": "value", "count": 42}'
              className="flex-1"
            />
          )}

          {/* Text Editor */}
          {inputData.type === "text" && (
            <div className="flex-1 flex flex-col overflow-hidden gap-2">
              <div className="flex-1 overflow-hidden border border-border bg-background" style={{ borderRadius: "10px" }}>
                <textarea
                  value={inputData.text || ""}
                  onChange={(e) => setInputData({ ...inputData, text: e.target.value })}
                  placeholder="Enter any text data..."
                  className="w-full h-full p-4 text-sm font-mono text-foreground resize-none overflow-auto outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {inputData.text?.length || 0} character{(inputData.text?.length || 0) !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {/* Form/Key-Value Editor */}
          {inputData.type === "form" && (
            <div className="flex-1 flex flex-col overflow-hidden gap-3">
              {/* Existing pairs */}
              {(inputData.form || []).length > 0 && (
                <div className="flex-1 overflow-y-auto border bg-muted/30" style={{ borderRadius: "10px" }}>
                  <div className="divide-y">
                    {(inputData.form || []).map((pair, index) => (
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
