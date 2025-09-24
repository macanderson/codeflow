"use client"

import React, { useState } from "react"
import { ProjectHeader } from "@/components/project-header"
import { ProjectSidebar } from "@/components/project-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { CodeProjectDisplay } from "@/components/code-project-display"
import { FileExplorer } from "@/components/file-explorer"
import { ProjectSettings } from "@/components/project-settings"
import { SandboxManager } from "@/components/sandbox-manager"

interface ProjectWorkspaceProps {
  projectId: string
}

type ActiveView = "chat" | "files" | "settings" | "sandbox"

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const [activeView, setActiveView] = useState<ActiveView>("chat")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [sandboxId, setSandboxId] = useState<string | null>(null)

  // Load project data from localStorage or API
  React.useEffect(() => {
    const loadProjectData = () => {
      const storedProject = localStorage.getItem('current_project')
      const storedSandbox = localStorage.getItem('current_sandbox')

      if (storedProject && storedSandbox) {
        try {
          const projectData = JSON.parse(storedProject)
          const sandboxData = JSON.parse(storedSandbox)
          console.log('Project data:', projectData)
          setProject(projectData)
          setSandboxId(sandboxData.sessionId)
        } catch (error) {
          console.error('Failed to parse stored project data:', error)
        }
      } else {
        // Fallback to mock data
        console.log('fallback to mock data')
        setProject({
          id: projectId,
          name: "Error Fetching Project Name",
          description: "React dashboard with analytics and user management",
          repository: "github.com/user/ecommerce-dashboard",
          framework: "Next.js",
          language: "TypeScript",
          status: "active" as const,
        })
      }
    }

    loadProjectData()
  }, [projectId])

  const mockFiles = [
    { path: "package.json", content: '{"name": "test", "version": "1.0.0"}' },
    { path: "src/index.js", content: 'console.log("Hello World");' },
  ]

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading project...
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <ProjectHeader project={project} activeView={activeView} onViewChange={setActiveView} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          project={project}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeView={activeView}
          onViewChange={setActiveView}
        />

        <main className="flex-1 flex overflow-hidden">
          {activeView === "chat" && (
            <div className="flex-1 flex">
              <ChatInterface projectId={projectId} sandboxId={sandboxId || undefined} />
              <CodeProjectDisplay
                projectId={projectId}
                sandboxId={sandboxId || undefined}
                projectName={project?.name}
              />
            </div>
          )}

          {activeView === "files" && <FileExplorer projectId={projectId} sandboxId={sandboxId || undefined} />}

          {activeView === "settings" && <ProjectSettings project={project} />}

          {activeView === "sandbox" && (
            <div className="flex-1 p-6">
              <SandboxManager
                projectId={projectId}
                files={mockFiles}
                onFileChange={(path, content) => {
                  console.log(`File changed: ${path}`, content)
                }}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
