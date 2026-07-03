"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
}: TextEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempValue, setTempValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  const handleSave = () => {
    onChange(tempValue)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setTempValue(value)
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault()
      handleSave()
    }
    if (e.key === "Escape") {
      handleCancel()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" style={{ borderRadius: "10px" }}>
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">
            {value ? `${value.length} chars` : "empty"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="!max-w-4xl !w-[95vw] !h-[80vh] flex flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ backgroundColor: "#171B1F" }}>
          <div>
            <DialogTitle className="text-base">{label}</DialogTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-4 min-h-[300px]" style={{ backgroundColor: "#171B1F" }}>
          <div className="flex-1 overflow-hidden rounded-lg border border-border bg-background">
            <textarea
              ref={textareaRef}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full h-full p-4 text-sm font-mono text-foreground resize-none overflow-auto outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {tempValue.length} character{tempValue.length !== 1 ? "s" : ""}
              {tempValue.split("\n").length > 1 && ` · ${tempValue.split("\n").length} line${tempValue.split("\n").length !== 1 ? "s" : ""}`}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
