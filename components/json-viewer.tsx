"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  /** Node label for drag-and-drop expressions (e.g., "Request" -> "{{Request.field}}") */
  nodeLabel?: string
  /** Path inside the tree to highlight, e.g. "root.body[0].body". When
   *  set, every ancestor path is force-expanded and the matching
   *  element gets a highlight ring so the user can spot it instantly.
   *  Pass `null` (the default) to leave the tree alone. */
  focusPath?: string | null
  /** Controlled search query. When provided together with
   *  `onSearchChange`, JsonViewer uses it for filtering/highlighting and
   *  skips its own search input — the host UI (e.g. DataPanel header)
   *  owns the input. Omit both props for the default internal search UI
   *  with a Ctrl+F shortcut. */
  search?: string
  onSearchChange?: (value: string) => void
  /** Controlled fullscreen view. When provided, the host owns the
   *  expand button and JsonViewer's internal header doesn't render the
   *  copy/expand buttons. The fullscreen dialog is still rendered by
   *  JsonViewer (it needs the tree-rendering closure); only its
   *  open/close state is controlled. */
  isExpandedView?: boolean
  onExpandedViewChange?: (open: boolean) => void
}

type ExpandedState = Set<string>

/**
 * Walk a `root.a[0].b`-style path and return every ancestor prefix.
 * The returned set always contains the bare root. Used to force-expand
 * a path that the user navigated to via an `{{...}}` click.
 *
 *   "root"                     → ["root"]
 *   "root.body"                → ["root", "root.body"]
 *   "root.body[0].body"        → ["root", "root.body", "root.body[0]"]
 */
function parentPathsOf(path: string): string[] {
  const tokens: string[] = []
  let buffer = ""
  for (let i = 0; i < path.length; i++) {
    const ch = path[i]
    if (ch === "." || ch === "[" || ch === "]") {
      if (buffer) {
        tokens.push(buffer)
        buffer = ""
      }
    } else {
      buffer += ch
    }
  }
  if (buffer) tokens.push(buffer)

  const ancestors: string[] = []
  let cumulative = ""
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prev = i > 0 ? tokens[i - 1] : ""
    const tokenIsArrayIndex = /^\d+$/.test(token)
    const prevIsArrayIndex = /^\d+$/.test(prev)
    if (i === 0) {
      cumulative = token
    } else if (prevIsArrayIndex) {
      // Previous was an array index → next must be an object key
      // (descending into a single array element). Use dot.
      cumulative = `${cumulative}.${token}`
    } else if (tokenIsArrayIndex) {
      // Previous was an object key → indexing into an array. Use bracket.
      cumulative = `${cumulative}[${token}]`
    } else {
      // Object key → object key. Use dot.
      cumulative = `${cumulative}.${token}`
    }
    ancestors.push(cumulative)
  }
  // Drop the last entry — that's the target itself, not an ancestor.
  return ancestors.slice(0, -1)
}

export function JsonViewer({
  data,
  title,
  nodeLabel,
  focusPath,
  search: searchProp,
  onSearchChange,
  isExpandedView: isExpandedViewProp,
  onExpandedViewChange,
}: JsonViewerProps) {
  const isSearchControlled = searchProp !== undefined
  const [internalSearch, setInternalSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  // When the host passes `search`, use it; otherwise fall back to
  // internal state. `setSearch` always routes through the right setter
  // so the rest of the component doesn't care which mode it's in.
  const search = isSearchControlled ? searchProp : internalSearch
  const setSearch = isSearchControlled
    ? (onSearchChange ?? (() => {}))
    : setInternalSearch
  // User-driven expand/collapse only. `expanded` (below) is the merged
  // view used by `renderValue` — it adds focus-path ancestors on top of
  // this set so user toggles survive focus changes without a cascading
  // setState-in-effect.
  const [userExpanded, setUserExpanded] = useState<ExpandedState>(
    () => new Set(["root"])
  )
  const [internalIsExpandedView, setInternalIsExpandedView] = useState(false)
  const isExpandedViewControlled = isExpandedViewProp !== undefined
  const isExpandedView = isExpandedViewControlled
    ? isExpandedViewProp
    : internalIsExpandedView
  const setIsExpandedView = isExpandedViewControlled
    ? (onExpandedViewChange ?? (() => {}))
    : setInternalIsExpandedView
  const [copied, setCopied] = useState(false)

  const focusExpansion = useMemo(
    () => (focusPath ? new Set(parentPathsOf(focusPath)) : null),
    [focusPath]
  )

  const expanded = useMemo(() => {
    const merged = new Set(userExpanded)
    if (focusExpansion) {
      for (const p of focusExpansion) merged.add(p)
    }
    return merged
  }, [userExpanded, focusExpansion])

  // When `focusPath` changes, the matching element gets attached to this
  // ref via callback refs inside `renderValue`. After commit, an effect
  // scrolls it into view so the user lands exactly on the highlighted
  // row instead of having to hunt for it in a long tree.
  const focusedElementRef = useRef<HTMLElement | null>(null)
  const setFocusedElementRef = useCallback((el: HTMLElement | null) => {
    focusedElementRef.current = el
  }, [])

  useEffect(() => {
    if (!focusPath) return
    // Defer one frame so the parent expansions and the focused row are
    // both committed before we ask the browser to scroll. Without this
    // rAF the element can be reported as not-yet-laid-out on first
    // mount and the scroll silently no-ops.
    const id = requestAnimationFrame(() => {
      focusedElementRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      })
    })
    return () => cancelAnimationFrame(id)
  }, [focusPath])

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

  // Ctrl+F / Cmd+F to toggle search. Only attaches when the host isn't
  // driving search externally — the host owns Ctrl+F when controlled.
  useEffect(() => {
    if (isSearchControlled) return
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
  }, [isSearchControlled])

  const toggleExpand = (path: string) => {
    setUserExpanded((prev) => {
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
    setUserExpanded(new Set(allPaths))
  }

  const collapseAll = () => {
    setUserExpanded(new Set(["root"]))
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

  // Convert internal path (root.body.id) to expression ({{NodeLabel.body.id}})
  const pathToExpression = (path: string): string => {
    if (!nodeLabel) return ""
    const cleanPath = path.replace(/^root\.?/, "")
    return cleanPath ? `{{${nodeLabel}.${cleanPath}}}` : `{{${nodeLabel}}}`
  }

  // Draggable wrapper for values. When `isFocused` is true, the wrapper
  // takes an orange ring so the focused element stands out from the
  // rest of the tree (used when the user clicked an `{{...}}` in the
  // URL field and we want to highlight where it comes from).
  const DraggableValue = ({
    path,
    isFocused,
    children,
  }: {
    path: string
    isFocused?: boolean
    children: React.ReactNode
  }) => {
    if (!nodeLabel) return <>{children}</>
    const expr = pathToExpression(path)
    return (
      <span
        ref={isFocused ? setFocusedElementRef : undefined}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", expr)
          e.dataTransfer.setData("application/x-expression", expr)
          e.dataTransfer.effectAllowed = "copy"
        }}
        className={cn(
          "rounded px-0.5 -mx-0.5 cursor-grab active:cursor-grabbing",
          isFocused
            ? "ring-2 ring-orange-500 bg-orange-500/15 hover:bg-orange-500/25"
            : "hover:bg-primary/10"
        )}
        title={`Drag to insert ${expr}`}
      >
        {children}
      </span>
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
      return (
        <DraggableValue path={path} isFocused={path === focusPath}>
          <span className="text-red-500">null</span>
        </DraggableValue>
      )
    }

    if (value === undefined) {
      return (
        <DraggableValue path={path} isFocused={path === focusPath}>
          <span className="text-red-500">undefined</span>
        </DraggableValue>
      )
    }

    if (typeof value === "boolean") {
      return (
        <DraggableValue path={path} isFocused={path === focusPath}>
          <span className="text-blue-500">
            {value ? "true" : "false"}
          </span>
        </DraggableValue>
      )
    }

    if (typeof value === "number") {
      return (
        <DraggableValue path={path} isFocused={path === focusPath}>
          <span className="text-orange-500">{value}</span>
        </DraggableValue>
      )
    }

    if (typeof value === "string") {
      return (
        <DraggableValue path={path} isFocused={path === focusPath}>
          <span className="text-green-600 dark:text-green-400">
            {`"${highlightText(value)}"`}
          </span>
        </DraggableValue>
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
                const itemPath = `${path}[${idx}]`
                const isFocused = itemPath === focusPath
                return (
                  <div
                    key={idx}
                    ref={isFocused ? setFocusedElementRef : undefined}
                    className={cn(
                      "flex gap-2 rounded",
                      !show && "opacity-30",
                      isFocused
                        ? "-mx-1 px-1 ring-2 ring-orange-500 bg-orange-500/10 cursor-grab"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <span className="text-muted-foreground min-w-8 text-xs">{idx}</span>
                    <div>
                      {renderValue(item, idx, itemPath, depth + 1)}
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
                const keyPath = `${path}.${k}`
                const isFocused = keyPath === focusPath

                return (
                  <div
                    key={k}
                    ref={isFocused ? setFocusedElementRef : undefined}
                    className={cn(
                      "flex gap-2 rounded",
                      !show && "opacity-30",
                      isFocused
                        ? "-mx-1 px-1 ring-2 ring-orange-500 bg-orange-500/10 cursor-grab"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <DraggableValue path={keyPath} isFocused={isFocused}>
                      <span className="text-purple-600 dark:text-purple-400">
                        {highlightText(k)}:
                      </span>
                    </DraggableValue>
                    <div>
                      {renderValue(v, k, keyPath, depth + 1)}
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
      {/* Header strip. Two modes:
          - Controlled search: no header strip at all (the host owns
            the search input AND the copy/expand buttons in its own
            header, so rendering them here would duplicate chrome).
          - Uncontrolled, search closed: Ctrl+F hint + copy + expand.
          - Uncontrolled, search open: full search bar (handled below). */}
      {!isSearchControlled && !showSearch ? (
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
      ) : null}

      {/* Search Bar (uncontrolled mode only — controlled host renders
          its own search input). */}
      {!isSearchControlled && showSearch && (
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
