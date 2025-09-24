"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { GitBranch, Clock, MoreHorizontal, Play, Settings, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface Project {
  id: string
  name: string
  description: string
  status: "active" | "completed" | "in-progress"
  lastModified: string
  repository: string
  framework: string
  language: string
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()

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

  const handleOpenProject = () => {
    router.push(`/project/${project.id}`)
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle
              className="text-lg group-hover:text-primary transition-colors cursor-pointer"
              onClick={handleOpenProject}
            >
              {project.name}
            </CardTitle>
            <CardDescription className="text-sm">{project.description}</CardDescription>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={getStatusColor(project.status)}>
            {project.status}
          </Badge>
          <Badge variant="secondary">{project.framework}</Badge>
          <Badge variant="secondary">{project.language}</Badge>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="truncate">{project.repository}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>Modified {project.lastModified}</span>
          </div>
        </div>

        <Button className="w-full" size="sm" onClick={handleOpenProject}>
          <Play className="h-4 w-4 mr-2" />
          Open Project
        </Button>
      </CardContent>
    </Card>
  )
}
