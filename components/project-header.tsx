"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  GitBranch,
  Play,
  Square,
  MoreHorizontal,
  Settings,
  Share,
  Download,
  Send as Sync,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface ProjectRepositoryInfo {
  id?: number
  name?: string
  full_name?: string
  html_url?: string
}

interface Project {
  id: string
  name: string
  description?: string
  repository?: string | ProjectRepositoryInfo
  framework?: string
  language?: string
  status?: "active" | "completed" | "in-progress" | string
}

interface ProjectHeaderProps {
  project: Project
  activeView: string
  onViewChange: (view: "chat" | "files" | "settings") => void
}

export function ProjectHeader({ project, activeView, onViewChange }: ProjectHeaderProps) {
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "completed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "in-progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const handleSyncRepository = () => {
    setIsSyncing(true)
    // Simulate sync operation
    setTimeout(() => {
      setIsSyncing(false)
    }, 2000)
  }

  const repositoryLabel = typeof project.repository === 'string'
    ? project.repository
    : project.repository?.full_name || project.repository?.name || 'repository'

  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>

          <div className="h-6 w-px bg-border" />

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{project.name || 'Project'}</h1>
              <Badge variant="outline" className={getStatusColor(project.status || 'active')}>
                {project.status || 'active'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GitBranch className="h-4 w-4" />
              <span>{repositoryLabel}</span>
              <span>•</span>
              <span>{project.framework || 'Next.js'}</span>
              <span>•</span>
              <span>{project.language || 'TypeScript'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleSyncRepository} disabled={isSyncing}>
            <Sync className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>

          <Button variant={isRunning ? "destructive" : "default"} size="sm" onClick={() => setIsRunning(!isRunning)}>
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewChange("settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Project Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share className="h-4 w-4 mr-2" />
                Share Project
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Export Code
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
