"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { IconPencil } from "@tabler/icons-react"

import { cn } from "@/lib/utils"

/**
 * Inline label editor for a node card. Clicking the label swaps it for
 * an `<input>`; Enter or blur commits, Escape cancels. Click and mousedown
 * events are stopped from propagating so React Flow doesn't interpret
 * the click as a node-select / node-drag interaction while the user is
 * editing the text.
 *
 * The `key={value}` on the input makes React mount a fresh `<input>`
 * whenever the upstream value changes (e.g. after a server load), so
 * the in-flight draft is reset to the new value without a syncing
 * effect (which would trip the `react-hooks/set-state-in-effect` rule).
 */
export function NodeLabel({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // When entering edit mode, focus the input and select its content so
  // the next keystroke replaces the whole label.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const commit = () => {
    if (draft !== value) onChange(draft)
    setIsEditing(false)
  }

  const cancel = () => {
    setDraft(value)
    setIsEditing(false)
  }

  const stop = (event: MouseEvent) => event.stopPropagation()

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      cancel()
    }
  }

  if (isEditing) {
    return (
      <input
        key={value}
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={stop}
        onMouseDown={stop}
        onDoubleClick={stop}
        // `min-w-0` lets the input shrink inside the flex row so the
        // label can grow/shrink without overflowing the card.
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none",
          "border-b border-ring",
          className
        )}
      />
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation()
        setIsEditing(true)
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      // `min-w-0` so the text div can shrink in the flex row.
      className={cn(
        "flex min-w-0 flex-1 cursor-text items-center gap-1.5 text-sm font-medium",
        className
      )}
    >
      <span className="truncate">{value || "Untitled"}</span>
      <IconPencil className="size-4 flex-shrink-0 text-muted-foreground" />
    </div>
  )
}
