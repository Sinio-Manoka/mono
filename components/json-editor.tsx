"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { IconWand } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type JsonEditorProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

// Tokenize JSON for syntax highlighting
function tokenizeJson(json: string): React.ReactNode[] {
  if (!json) return []

  const tokens: React.ReactNode[] = []
  let i = 0

  while (i < json.length) {
    // Whitespace
    if (/\s/.test(json[i])) {
      let ws = ""
      while (i < json.length && /\s/.test(json[i])) {
        ws += json[i]
        i++
      }
      tokens.push(ws)
      continue
    }

    // String
    if (json[i] === '"') {
      let str = '"'
      i++
      while (i < json.length && json[i] !== '"') {
        if (json[i] === "\\") {
          str += json[i]
          i++
          if (i < json.length) {
            str += json[i]
            i++
          }
        } else {
          str += json[i]
          i++
        }
      }
      if (i < json.length) {
        str += '"'
        i++
      }
      // Check if this is a key (followed by :)
      let j = i
      while (j < json.length && /\s/.test(json[j])) j++
      if (json[j] === ":") {
        tokens.push(
          <span key={tokens.length} className="text-purple-400">
            {str}
          </span>
        )
      } else {
        tokens.push(
          <span key={tokens.length} className="text-green-400">
            {str}
          </span>
        )
      }
      continue
    }

    // Number
    if (/[-\d]/.test(json[i])) {
      let num = ""
      while (i < json.length && /[-\d.eE+]/.test(json[i])) {
        num += json[i]
        i++
      }
      tokens.push(
        <span key={tokens.length} className="text-orange-400">
          {num}
        </span>
      )
      continue
    }

    // Boolean or null
    if (json.slice(i, i + 4) === "true") {
      tokens.push(
        <span key={tokens.length} className="text-blue-400">
          true
        </span>
      )
      i += 4
      continue
    }
    if (json.slice(i, i + 5) === "false") {
      tokens.push(
        <span key={tokens.length} className="text-blue-400">
          false
        </span>
      )
      i += 5
      continue
    }
    if (json.slice(i, i + 4) === "null") {
      tokens.push(
        <span key={tokens.length} className="text-red-400">
          null
        </span>
      )
      i += 4
      continue
    }

    // Brackets and braces
    if (/[{}\[\]:,]/.test(json[i])) {
      tokens.push(
        <span key={tokens.length} className="text-gray-400">
          {json[i]}
        </span>
      )
      i++
      continue
    }

    // Unknown character
    tokens.push(json[i])
    i++
  }

  return tokens
}

export function JsonEditor({ value, onChange, placeholder, className }: JsonEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const [localValue, setLocalValue] = useState(value)

  // Sync scroll between textarea and pre
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  // Validation
  const validation = useMemo(() => {
    if (!localValue?.trim()) return { valid: true, error: null }
    try {
      JSON.parse(localValue)
      return { valid: true, error: null }
    } catch (e) {
      return { valid: false, error: (e as Error).message }
    }
  }, [localValue])

  // Format JSON
  const formatJson = useCallback(() => {
    if (!localValue?.trim() || !validation.valid) return
    try {
      const parsed = JSON.parse(localValue)
      const formatted = JSON.stringify(parsed, null, 2)
      setLocalValue(formatted)
      onChange(formatted)
    } catch {
      // Can't format
    }
  }, [localValue, validation.valid, onChange])

  // Handle key events for auto-formatting
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Format on Shift+Enter
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault()
      formatJson()
      return
    }

    // Handle Tab for indentation
    if (e.key === "Tab") {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      const newValue = localValue.substring(0, start) + "  " + localValue.substring(end)
      setLocalValue(newValue)
      onChange(newValue)

      // Move cursor after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
      return
    }

    // Auto-close brackets
    const pairs: Record<string, string> = {
      "{": "}",
      "[": "]",
      '"': '"',
    }

    if (pairs[e.key]) {
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // Don't auto-close if there's a selection or if next char is the same
      if (start !== end) return
      if (e.key === '"' && localValue[start] === '"') return

      e.preventDefault()
      const newValue =
        localValue.substring(0, start) + e.key + pairs[e.key] + localValue.substring(end)
      setLocalValue(newValue)
      onChange(newValue)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
    }
  }

  // Auto-format after typing a closing bracket/brace followed by Enter
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange(newValue)
  }

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Highlighted content
  const highlighted = useMemo(() => tokenizeJson(localValue), [localValue])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          "relative flex-1 overflow-hidden border bg-background transition-colors font-mono text-sm",
          localValue?.trim() && !validation.valid
            ? "border-red-500/50"
            : localValue?.trim() && validation.valid
            ? "border-green-500/50"
            : "border-border"
        )}
        style={{ borderRadius: "10px" }}
      >
        {/* Highlighted layer */}
        <pre
          ref={preRef}
          className="absolute inset-0 p-4 overflow-auto whitespace-pre-wrap break-all pointer-events-none m-0"
          aria-hidden="true"
        >
          {highlighted}
          {!localValue && (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </pre>

        {/* Editable textarea */}
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          className="relative w-full h-full p-4 bg-transparent text-transparent caret-white resize-none overflow-auto outline-none"
          style={{ caretColor: "white" }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {localValue?.trim() && !validation.valid ? (
            <span className="text-xs text-red-500">{validation.error}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {localValue?.length || 0} chars
              {localValue?.trim() && validation.valid && (
                <span className="text-green-500 ml-2">Valid JSON</span>
              )}
              <span className="text-muted-foreground/50 ml-2">Shift+Enter to format</span>
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={formatJson}
          disabled={!localValue?.trim() || !validation.valid}
          className="h-7 text-xs gap-1"
        >
          <IconWand className="size-3" />
          Format
        </Button>
      </div>
    </div>
  )
}
