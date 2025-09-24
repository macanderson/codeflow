"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  MessageSquare,
  Files,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  Globe,
  Terminal,
  GitBranch,
  Play,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  description: string
  repository: string
  framework: string
  language: string
  status: "active" | "completed" | "in-progress"
}

interface ProjectSidebarProps {
  project: Project
  collapsed: boolean
  onToggleCollapse: () => void
  activeView: string
  onViewChange: (view: "chat" | "files" | "settings" | "sandbox") => void
}

export function ProjectSidebar({
  project,
  collapsed,
  onToggleCollapse,
  activeView,
  onViewChange,
}: ProjectSidebarProps) {
  const navigationItems = [
    {
      id: "chat",
      label: "AI Assistant",
      icon: MessageSquare,
      description: "Chat with your coding agent",
    },
    {
      id: "sandbox",
      label: "Sandbox",
      icon: Play,
      description: "Run code in e2b sandbox",
    },
  ]

  const toolItems = [
    {
      id: "database",
      label: "Database",
      icon: Database,
      description: "Manage database connections",
    },
    {
      id: "api",
      label: "API Testing",
      icon: Globe,
      description: "Test API endpoints",
    },
    {
      id: "terminal",
      label: "Terminal",
      icon: Terminal,
      description: "Run commands in sandbox",
    },
    {
      id: "git",
      label: "Git Integration",
      icon: GitBranch,
      description: "Manage version control",
    },
  ]

  return (
    <div className={cn("border-r border-border bg-card transition-all duration-200", collapsed ? "w-16" : "w-64")}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-4">
          {!collapsed && <h2 className="text-sm font-medium text-muted-foreground">Project Tools</h2>}
          <Button variant="ghost" size="sm" onClick={onToggleCollapse} className="h-8 w-8 p-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-6">
            {/* Navigation */}
            <div className="space-y-2">
              {!collapsed && (
                <h3 className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Navigation</h3>
              )}
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeView === item.id ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", collapsed ? "px-2" : "px-3")}
                  onClick={() => onViewChange(item.id as "chat" | "files" | "settings" | "sandbox")}
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span className="ml-3">{item.label}</span>}
                </Button>
              ))}
            </div>

            <Separator />

            {/* Tools */}
            <div className="space-y-2">
              {!collapsed && (
                <h3 className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tools</h3>
              )}
              {toolItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-muted-foreground hover:text-foreground",
                    collapsed ? "px-2" : "px-3",
                  )}
                  onClick={() => {
                    // TODO: Implement tool functionality
                    console.log(`Opening ${item.label}`)
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  {!collapsed && <span className="ml-3">{item.label}</span>}
                </Button>
              ))}
            </div>

            <Separator />

            {/* Settings */}
            <div className="space-y-2">
              <Button
                variant={activeView === "settings" ? "secondary" : "ghost"}
                className={cn("w-full justify-start", collapsed ? "px-2" : "px-3")}
                onClick={() => onViewChange("settings")}
              >
                <Settings className="h-4 w-4" />
                {!collapsed && <span className="ml-3">Settings</span>}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
