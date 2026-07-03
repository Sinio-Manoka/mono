"use client"

import { useState, useMemo, useEffect } from "react"
import { IconChevronRight, IconX, IconArrowsMaximize, IconCopy, IconCheck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type JsonViewerProps = {
  data: unknown
  title?: string
}

type ExpandedState = Set<string>

export function JsonViewer({ data, title }: JsonViewerProps) {
  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [expanded, setExpanded] = useState<ExpandedState>(new Set(["root"]))
  const [isExpandedView, setIsExpandedView] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const text = typeof data === "string" ? data : JSON.stringify(data, null, 2)
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("Failed to copy", err)
    }
  }

  // Ctrl+F / Cmd+F to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault()
        setShowSearch((prev) => !prev)
      }
      if (e.key === "Escape") {
        setShowSearch(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const expandAll = () => {
    const allPaths = getAllPaths(data, "root")
    setExpanded(new Set(allPaths))
  }

  const collapseAll = () => {
    setExpanded(new Set(["root"]))
  }

  const getAllPaths = (value: unknown, path: string): string[] => {
    const paths: string[] = [path]
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        value.forEach((item, i) => {
          paths.push(...getAllPaths(item, `${path}[${i}]`))
        })
      } else {
        Object.entries(value).forEach(([k, v]) => {
          paths.push(...getAllPaths(v, `${path}.${k}`))
        })
      }
    }
    return paths
  }

  const countMatches = useMemo(() => {
    if (!search) return 0
    const cleanSearch = search.replace(/['"]/g, "")
    if (!cleanSearch) return 0

    let count = 0
    const searchLower = cleanSearch.toLowerCase()

    const traverse = (val: unknown) => {
      if (typeof val === "string") {
        const matches = val.match(new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"))
        if (matches) count += matches.length
      } else if (typeof val === "object" && val !== null) {
        if (Array.isArray(val)) {
          val.forEach(traverse)
        } else {
          Object.entries(val).forEach(([k, v]) => {
            if (k.toLowerCase().includes(searchLower)) {
              count++
            }
            traverse(v)
          })
        }
      }
    }

    traverse(data)
    return count
  }, [search, data])

  const shouldShowItem = (text: string): boolean => {
    if (!search) return true
    // Ignore quote characters in search
    const cleanSearch = search.replace(/['"]/g, "")
    if (!cleanSearch) return true
    return text.toLowerCase().includes(cleanSearch.toLowerCase())
  }

  const highlightText = (text: string): React.ReactNode => {
    if (!search) return text

    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
    const parts = text.split(regex)

    return parts.map((part, i) =>
      part && part.toLowerCase() === search.toLowerCase() ? (
        <span
          key={i}
          className="bg-yellow-300 dark:bg-yellow-400 text-slate-900 font-bold px-0.5 rounded"
        >
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  const renderValue = (
    value: unknown,
    key: string | number | null,
    path: string,
    depth: number
  ): React.ReactNode => {
    const isExpanded = expanded.has(path)

    if (value === null) {
      return <span className="text-red-500">null</span>
    }

    if (value === undefined) {
      return <span className="text-red-500">undefined</span>
    }

    if (typeof value === "boolean") {
      return (
        <span className="text-blue-500">
          {value ? "true" : "false"}
        </span>
      )
    }

    if (typeof value === "number") {
      return <span className="text-orange-500">{value}</span>
    }

    if (typeof value === "string") {
      return (
        <span className="text-green-600 dark:text-green-400">
          "{highlightText(value)}"
        </span>
      )
    }

    if (Array.isArray(value)) {
      const isEmpty = value.length === 0

      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleExpand(path)}
              className="flex items-center justify-center w-5 h-5 hover:bg-muted rounded transition-colors"
            >
              <IconChevronRight
                className={cn("size-4 text-primary transition-transform", isExpanded && "rotate-90")}
              />
            </button>
            <span className="text-primary font-semibold">[</span>
            {isEmpty ? (
              <span className="text-primary font-semibold">]</span>
            ) : (
              <span className="text-muted-foreground text-xs">{value.length}</span>
            )}
          </div>

          {isExpanded && !isEmpty && (
            <div className="ml-4 space-y-0.5 border-l border-border pl-3">
              {value.map((item, idx) => {
                const itemStr = JSON.stringify(item)
                const show = shouldShowItem(itemStr)
                return (
                  <div
                    key={idx}
                    className={cn("flex gap-2", !show && "opacity-30")}
                  >
                    <span className="text-muted-foreground min-w-8 text-xs">{idx}</span>
                    <div>
                      {renderValue(item, idx, `${path}[${idx}]`, depth + 1)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {isExpanded && !isEmpty && (
            <div className="ml-4 text-primary font-semibold">]</div>
          )}
        </div>
      )
    }

    if (typeof value === "object") {
      const entries = Object.entries(value)
      const isEmpty = entries.length === 0

      return (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleExpand(path)}
              className="flex items-center justify-center w-5 h-5 hover:bg-muted rounded transition-colors"
            >
              <IconChevronRight
                className={cn("size-4 text-primary transition-transform", isExpanded && "rotate-90")}
              />
            </button>
            <span className="text-primary font-semibold">{"{"}</span>
            {isEmpty ? (
              <span className="text-primary font-semibold">{"}"}</span>
            ) : (
              <span className="text-muted-foreground text-xs">{entries.length}</span>
            )}
          </div>

          {isExpanded && !isEmpty && (
            <div className="ml-4 space-y-0.5 border-l border-border pl-3">
              {entries.map(([k, v]) => {
                const keyMatch = shouldShowItem(k)
                const valueStr = JSON.stringify(v)
                const valueMatch = shouldShowItem(valueStr)
                const show = keyMatch || valueMatch

                return (
                  <div
                    key={k}
                    className={cn("flex gap-2", !show && "opacity-30")}
                  >
                    <span className="text-purple-600 dark:text-purple-400">
                      {highlightText(k)}:
                    </span>
                    <div>
                      {renderValue(v, k, `${path}.${k}`, depth + 1)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {isExpanded && !isEmpty && (
            <div className="ml-4 text-primary font-semibold">{"}"}</div>
          )}
        </div>
      )
    }

    return <span>{String(value)}</span>
  }

  return (
    <div className="flex flex-col h-full gap-0 bg-background rounded-lg border border-border overflow-hidden">
      {/* Hint and expand button */}
      {!showSearch && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/20 text-xs text-muted-foreground">
          <span>Press <kbd className="px-1.5 py-0.5 bg-background border border-border rounded text-xs">Ctrl+F</kbd> to search</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-7 w-7 p-0"
              title="Copy"
            >
              {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpandedView(true)}
              className="h-7 w-7 p-0"
              title="Expand"
            >
              <IconArrowsMaximize className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <input
            type="text"
            placeholder="Search (Ctrl+F)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded outline-none focus:ring-1 focus:ring-ring"
          />

          {search && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {countMatches} found
            </span>
          )}

          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={expandAll}
              className="h-7 text-xs"
            >
              Expand
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={collapseAll}
              className="h-7 text-xs"
            >
              Collapse
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 w-7 p-0"
            title="Copy"
          >
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpandedView(true)}
            className="h-7 w-7 p-0"
            title="Expand"
          >
            <IconArrowsMaximize className="size-4" />
          </Button>

          <button
            onClick={() => {
              setShowSearch(false)
              setSearch("")
            }}
            className="p-1 hover:bg-muted rounded"
          >
            <IconX className="size-4" />
          </button>
        </div>
      )}

      {/* Viewer */}
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm text-foreground">
        {renderValue(data, null, "root", 0)}
      </div>

      {/* Expanded view dialog */}
      <Dialog open={isExpandedView} onOpenChange={setIsExpandedView}>
        <DialogContent className="!max-w-none !w-[99vw] !h-[98vh] overflow-hidden flex flex-col p-6">
          <DialogHeader>
            <DialogTitle>{title || "JSON Viewer"}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            {/* Search Bar in expanded view */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded border border-border">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded outline-none focus:ring-1 focus:ring-ring"
              />

              {search && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {countMatches} found
                </span>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={expandAll}
                className="h-7 text-xs"
              >
                Expand
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={collapseAll}
                className="h-7 text-xs"
              >
                Collapse
              </Button>
            </div>

            {/* Expanded Viewer */}
            <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm text-foreground border border-border rounded bg-background">
              {renderValue(data, null, "root", 0)}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
