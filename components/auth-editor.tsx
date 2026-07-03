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

type AuthType = "none" | "bearer" | "basic" | "api-key"

type AuthEditorProps = {
  value: string
  onChange: (value: string) => void
}

interface AuthData {
  type: AuthType
  token?: string
  username?: string
  password?: string
  apiKey?: string
  apiKeyHeader?: string
}

export function AuthEditor({ value, onChange }: AuthEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [authData, setAuthData] = useState<AuthData>(() => {
    try {
      return value ? JSON.parse(value) : { type: "none" }
    } catch {
      return { type: "none" }
    }
  })

  const handleSave = () => {
    onChange(JSON.stringify(authData))
    setIsOpen(false)
  }

  const handleCancel = () => {
    setIsOpen(false)
  }

  const getDisplayText = () => {
    switch (authData.type) {
      case "bearer":
        return authData.token ? "Bearer •••••" : "Bearer (empty)"
      case "basic":
        return authData.username ? `Basic ${authData.username}` : "Basic (empty)"
      case "api-key":
        return authData.apiKey ? "API Key •••••" : "API Key (empty)"
      default:
        return "None"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" style={{ borderRadius: "10px" }}>
          <span>Authorization</span>
          <span className="text-xs text-muted-foreground">{getDisplayText()}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Authorization</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auth Type Selection */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {(["none", "bearer", "basic", "api-key"] as AuthType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={authData.type === type ? "default" : "outline"}
                  onClick={() => setAuthData({ ...authData, type })}
                  className="capitalize"
                >
                  {type === "api-key" ? "API Key" : type}
                </Button>
              ))}
            </div>
          </div>

          {/* Auth Fields */}
          <div className="space-y-3 border-t pt-4">
            {authData.type === "bearer" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">Token</label>
                <input
                  type="text"
                  value={authData.token || ""}
                  onChange={(e) => setAuthData({ ...authData, token: e.target.value })}
                  placeholder="Enter your bearer token"
                  className="w-full px-3 py-2 border text-sm bg-background"
                  style={{ borderRadius: "10px" }}
                />
              </div>
            )}

            {authData.type === "basic" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Username</label>
                  <input
                    type="text"
                    value={authData.username || ""}
                    onChange={(e) => setAuthData({ ...authData, username: e.target.value })}
                    placeholder="Username"
                    className="w-full px-3 py-2 border text-sm bg-background"
                    style={{ borderRadius: "10px" }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Password</label>
                  <input
                    type="password"
                    value={authData.password || ""}
                    onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                    placeholder="Password"
                    className="w-full px-3 py-2 border text-sm bg-background"
                    style={{ borderRadius: "10px" }}
                  />
                </div>
              </>
            )}

            {authData.type === "api-key" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Key Name (Header)</label>
                  <input
                    type="text"
                    value={authData.apiKeyHeader || ""}
                    onChange={(e) => setAuthData({ ...authData, apiKeyHeader: e.target.value })}
                    placeholder="e.g., X-API-Key"
                    className="w-full px-3 py-2 border text-sm bg-background"
                    style={{ borderRadius: "10px" }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Key Value</label>
                  <input
                    type="text"
                    value={authData.apiKey || ""}
                    onChange={(e) => setAuthData({ ...authData, apiKey: e.target.value })}
                    placeholder="Enter your API key"
                    className="w-full px-3 py-2 border text-sm bg-background"
                    style={{ borderRadius: "10px" }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4 border-t">
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
