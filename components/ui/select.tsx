"use client"

import { useEffect, useRef, useState } from "react"
import { IconCheck, IconChevronDown } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  /** Disable the control (greyed out, no click). */
  disabled?: boolean
  /** Optional aria-label for the trigger button when there's no visible label. */
  "aria-label"?: string
}

/**
 * Custom dropdown — replaces native `<select>` so the open menu honours
 * the app's shadcn-token design (popover surface, orange selection tint,
 * matched hover/keyboard state). Native `<select>` is OS-styled and would
 * never match.
 *
 * Keyboard: ↓/↑ to move, Enter/Space to commit, Escape to close.
 * Mouse: click trigger to toggle, click option to commit, click outside
 * to close. Hovering an option also moves the keyboard cursor so the
 * two stay in sync.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  className,
  id,
  disabled = false,
  "aria-label": ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null

  // When the menu opens, jump the keyboard cursor onto the currently
  // selected option (or the first row when nothing's selected) so Enter
  // doesn't commit a value the user can't see. Done in the open handler
  // (not in a `useEffect`) so we don't pay a sync-render round trip.
  const openMenu = (next: boolean) => {
    if (next) {
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
    }
    setOpen(next)
  }

  // Close on any pointer-down outside the container.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (open) return
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault()
      openMenu(true)
    }
  }

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return

    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1))
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
      return
    }

    if (e.key === "Home") {
      e.preventDefault()
      setHighlightedIndex(0)
      return
    }

    if (e.key === "End") {
      e.preventDefault()
      setHighlightedIndex(options.length - 1)
      return
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const option = options[highlightedIndex]
      if (option) {
        onChange(option.value)
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onKeyDown={handleContainerKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && openMenu(!open)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm",
          "text-foreground outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          open && "border-ring ring-3 ring-ring/30",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            !selectedOption && "text-muted-foreground"
          )}
        >
          {selectedOption?.label || placeholder}
        </span>
        <IconChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto",
            "rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value
            const isHighlighted = idx === highlightedIndex
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                  isHighlighted ? "bg-muted" : "hover:bg-muted/60",
                  isSelected && "text-orange-600 dark:text-orange-400 font-medium"
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <IconCheck
                    className="size-4 shrink-0 text-orange-500"
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}