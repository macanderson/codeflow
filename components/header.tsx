"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, User, LogOut, Download } from "lucide-react"

function getCurrentSandboxAndProject(): { sandboxId?: string; projectName?: string } {
  try {
    const sandboxRaw = typeof window !== 'undefined' ? localStorage.getItem('current_sandbox') : null
    const projectRaw = typeof window !== 'undefined' ? localStorage.getItem('current_project') : null
    const sandbox = sandboxRaw ? JSON.parse(sandboxRaw) : null
    const project = projectRaw ? JSON.parse(projectRaw) : null
    return { sandboxId: sandbox?.sessionId, projectName: project?.name }
  } catch {
    return {}
  }
}

async function downloadProjectZip() {
  const { sandboxId, projectName } = getCurrentSandboxAndProject()
  if (!sandboxId) {
    alert("No active sandbox. Open a project first.")
    return
  }

  const baseName = (projectName || "project").toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "")
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const zipFileName = `${baseName}_${ts}.zip`

  // Zip workspace inside sandbox
  const zipResp = await fetch(`/api/sandbox/${sandboxId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: `mkdir -p /home/user/exports && cd /home/user/workspace && zip -r /home/user/exports/${zipFileName} .`
    })
  })
  if (!zipResp.ok) {
    alert("Failed to prepare ZIP in sandbox.")
    return
  }
  const zipJson = await zipResp.json()
  if (zipJson?.exitCode && zipJson.exitCode !== 0) {
    alert("ZIP command failed in sandbox. See console for details.")
    return
  }

  // Download the produced ZIP
  const dlResp = await fetch(`/api/sandbox/${sandboxId}/file?path=${encodeURIComponent(`/home/user/exports/${zipFileName}`)}`)
  if (!dlResp.ok) {
    alert("Failed to download ZIP from sandbox.")
    return
  }
  const blob = await dlResp.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipFileName
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }, 100)
}

export function Header() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold">
              CA
            </div>
            <span className="text-xl font-semibold">CodeAgent</span>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadProjectZip}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Project
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
