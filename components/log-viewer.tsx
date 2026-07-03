"use client"

import { useState, useMemo } from "react"
import { IconChevronDown, IconSearch } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LogViewerProps = {
  data: unknown
  title: string
}

export function LogViewer({ data, title }: LogViewerProps) {
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]))

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpanded(new Set(getAllKeys(data)))
  }

  const collapseAll = () => {
    setExpanded(new Set())
  }

  const getAllKeys = (obj: unknown, prefix = ""): string[] => {
    const keys: string[] = []
    if (obj && typeof obj === "object") {
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => {
          const key = `${prefix}[${idx}]`
          keys.push(key)
          keys.push(...getAllKeys(item, key))
        })
      } else {
        Object.entries(obj).forEach(([k, v]) => {
          const key = prefix ? `${prefix}.${k}` : k
          keys.push(key)
          if (v && typeof v === "object") {
            keys.push(...getAllKeys(v, key))
          }
        })
      }
    }
    return keys
  }

  const renderValue = (value: unknown, key: string, depth = 0): React.ReactNode => {
    if (value === null) return <span className="text-red-500">null</span>
    if (value === undefined) return <span className="text-red-500">undefined</span>
    if (typeof value === "boolean")
      return <span className="text-blue-500">{value.toString()}</span>
    if (typeof value === "number") return <span className="text-cyan-500">{value}</span>
    if (typeof value === "string") {
      const matchesSearch =
        !search || value.toLowerCase().includes(search.toLowerCase())
      return (
        <span className={cn("text-green-500", !matchesSearch && "opacity-50")}>
          "{value}"
        </span>
      )
    }

    if (Array.isArray(value)) {
      const isExpanded = expanded.has(key)
      return (
        <div className="space-y-1">
          <button
            onClick={() => toggleExpanded(key)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <IconChevronDown
              className={cn("size-4 transition-transform", !isExpanded && "-rotate-90")}
            />
            <span className="text-blue-400">[Array({value.length})]</span>
          </button>
          {isExpanded && (
            <div className="ml-4 space-y-1 border-l border-muted pl-3">
              {value.map((item, idx) => (
                <div key={idx}>
                  <span className="text-muted-foreground">[{idx}]:</span>{" "}
                  {renderValue(item, `${key}[${idx}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (typeof value === "object") {
      const isExpanded = expanded.has(key)
      const entries = Object.entries(value)
      const matchingEntries = entries.filter(
        ([k, v]) =>
          !search ||
          k.toLowerCase().includes(search.toLowerCase()) ||
          JSON.stringify(v).toLowerCase().includes(search.toLowerCase())
      )

      return (
        <div className="space-y-1">
          <button
            onClick={() => toggleExpanded(key)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <IconChevronDown
              className={cn("size-4 transition-transform", !isExpanded && "-rotate-90")}
            />
            <span className="text-yellow-400">{"{"}</span>
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {matchingEntries.length}/{entries.length}
              </span>
            )}
          </button>
          {isExpanded && (
            <div className="ml-4 space-y-1 border-l border-muted pl-3">
              {matchingEntries.map(([k, v]) => (
                <div key={k}>
                  <span className="text-purple-400">{k}:</span>{" "}
                  {renderValue(v, `${key}.${k}`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return <span>{String(value)}</span>
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border rounded bg-background"
          />
        </div>
        <Button size="sm" variant="outline" onClick={expandAll}>
          Expand
        </Button>
        <Button size="sm" variant="outline" onClick={collapseAll}>
          Collapse
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto border rounded p-3 bg-muted/20 font-mono text-xs">
        {renderValue(data, "root")}
      </div>
    </div>
  )
}
