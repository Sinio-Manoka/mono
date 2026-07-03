"use client"

import { useState } from "react"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type KeyValuePair = { key: string; value: string }

type KeyValueEditorProps = {
  value: string
  onChange: (value: string) => void
  label: string
  description?: string
}

export function KeyValueEditor({
  value,
  onChange,
  label,
}: KeyValueEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [pairs, setPairs] = useState<KeyValuePair[]>(() => {
    try {
      const parsed = value ? JSON.parse(value) : {}
      return Object.entries(parsed).map(([k, v]) => ({
        key: k,
        value: String(v),
      }))
    } catch {
      return []
    }
  })
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")

  const handleAddPair = () => {
    if (newKey.trim()) {
      setPairs((prev) => [...prev, { key: newKey.trim(), value: newValue }])
      setNewKey("")
      setNewValue("")
    }
  }

  const handleRemovePair = (index: number) => {
    setPairs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateKey = (index: number, newKey: string) => {
    setPairs((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], key: newKey }
      return updated
    })
  }

  const handleUpdateValue = (index: number, newValue: string) => {
    setPairs((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], value: newValue }
      return updated
    })
  }

  const handleSave = () => {
    const obj = Object.fromEntries(pairs.map((p) => [p.key, p.value]))
    onChange(JSON.stringify(obj))
    setIsOpen(false)
  }

  const pairCount = pairs.length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" style={{ borderRadius: "10px" }}>
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">
            {pairCount > 0 ? `${pairCount}` : "0"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* List of existing pairs */}
          {pairs.length > 0 && (
            <div className="border bg-muted/30 max-h-56 overflow-y-auto" style={{ borderRadius: "10px" }}>
              <div className="divide-y">
                {pairs.map((pair, index) => (
                  <div key={index} className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={pair.key}
                        onChange={(e) => handleUpdateKey(index, e.target.value)}
                        placeholder="Key"
                        className="flex-1 px-2 py-1 border text-sm bg-background"
                        style={{ borderRadius: "10px" }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePair(index)}
                        className="px-2 h-auto py-1"
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                    <input
                      type="text"
                      value={pair.value}
                      onChange={(e) => handleUpdateValue(index, e.target.value)}
                      placeholder="Value"
                      className="w-full px-2 py-1 border text-sm bg-background"
                      style={{ borderRadius: "10px" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new pair */}
          <div className="border p-3 space-y-2 bg-muted/30" style={{ borderRadius: "10px" }}>
            <p className="text-xs font-semibold text-muted-foreground">Add New</p>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPair()}
              placeholder="Key"
              className="w-full px-2 py-1.5 border text-sm bg-background"
              style={{ borderRadius: "10px" }}
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPair()}
              placeholder="Value"
              className="w-full px-2 py-1.5 border text-sm bg-background"
              style={{ borderRadius: "10px" }}
            />
            <Button type="button" onClick={handleAddPair} className="w-full" size="sm">
              <IconPlus className="size-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Save button */}
          <Button type="button" onClick={handleSave} className="w-full">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
