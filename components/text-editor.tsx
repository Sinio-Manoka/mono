"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type TextEditorProps = {
  value: string
  onChange: (value: string) => void
  label: string
  description?: string
  placeholder?: string
  rows?: number
}

export function TextEditor({
  value,
  onChange,
  label,
  description,
  placeholder,
  rows = 6,
}: TextEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempValue, setTempValue] = useState(value)

  const handleSave = () => {
    onChange(tempValue)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempValue(value)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">
            {value ? `${value.length} chars` : "empty"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}

          <div className="border rounded p-3 bg-muted/30">
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              placeholder={placeholder}
              rows={rows}
              className="w-full p-3 border rounded text-sm font-mono bg-background resize-none overflow-auto"
            />
          </div>

          {/* Save button */}
          <div className="flex gap-2">
            <Button type="button" onClick={handleSave} className="flex-1">
              Save
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
