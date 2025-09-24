"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Code,
  Eye,
  Download,
  Copy,
  Play,
  Square,
  MoreHorizontal,
  FileText,
  Folder,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AppPreview } from "@/components/app-preview"

interface CodeFile {
  id: string
  name: string
  path: string
  content: string
  language: string
  type: "file" | "folder"
  children?: CodeFile[]
  isOpen?: boolean
}

interface CodeProject {
  id: string
  name: string
  description: string
  framework: string
  files: CodeFile[]
  previewUrl?: string
  status: "generating" | "ready" | "error"
}

interface CodeProjectDisplayProps {
  projectId: string
  sandboxId?: string
  projectName?: string
}

export function CodeProjectDisplay({ projectId, sandboxId, projectName }: CodeProjectDisplayProps) {
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  // Mock code project data
  const codeProject: CodeProject = {
    id: projectId,
    name: projectName || "Error Fetching Project Name",
    description: "",
    framework: "",
    status: "ready",
    previewUrl: "https://preview.example.com",
    files: mockFiles,
  }

  const handleFileSelect = (fileId: string) => {
    setActiveFile(fileId)
  }

  const handleToggleFolder = (folderId: string) => {
    // TODO: Implement folder toggle logic
    console.log("Toggling folder:", folderId)
  }

  const handleCopyCode = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleDownloadProject = () => {
    // TODO: Implement project download
    console.log("Downloading project")
  }

  const handleRunProject = () => {
    setIsRunning(!isRunning)
    if (!isRunning) {
      // Start the project in e2b sandbox
      fetch("/api/sandbox/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          template: "node",
          files: codeProject.files.map((f) => ({ path: f.path, content: f.content })),
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("[v0] Sandbox created:", data)
          // Execute npm start command
          return fetch(`/api/sandbox/${data.sessionId}/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: "npm install && npm start" }),
          })
        })
        .then((response) => response.json())
        .then((data) => {
          console.log("[v0] Project started:", data)
        })
        .catch((error) => {
          console.error("[v0] Failed to run project:", error)
          setIsRunning(false)
        })
    } else {
      // Stop the project
      console.log("[v0] Stopping project")
    }
  }

  const selectedFile = codeProject.files.find((file) => file.id === activeFile)

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{codeProject.name}</h3>
            <Badge variant="secondary">{codeProject.framework}</Badge>
            <StatusBadge status={codeProject.status} />
          </div>
          <p className="text-sm text-muted-foreground">{codeProject.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={cn(isPreviewMode && "bg-primary text-primary-foreground")}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>

          <Button variant="outline" size="sm" onClick={handleRunProject}>
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
              <DropdownMenuItem onClick={handleDownloadProject}>
                <Download className="h-4 w-4 mr-2" />
                Download ZIP
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </DropdownMenuItem>
              <DropdownMenuItem>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {isPreviewMode ? (
          <AppPreview sandboxId={sandboxId} projectName={projectName} />
        ) : (
          <>
            {/* File Tree */}
            <div className="w-64 border-r border-border">
              <div className="p-3 border-b border-border">
                <h4 className="text-sm font-medium">Files</h4>
              </div>
              <ScrollArea className="h-full">
                <div className="p-2">
                  <FileTree files={codeProject.files} onFileSelect={handleFileSelect} activeFile={activeFile} />
                </div>
              </ScrollArea>
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col">
              {selectedFile ? (
                <CodeEditor file={selectedFile} onCopy={handleCopyCode} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Code className="h-12 w-12 mx-auto opacity-50" />
                    <p>Select a file to view its contents</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  status: CodeProject["status"]
}

function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = (status: CodeProject["status"]) => {
    switch (status) {
      case "generating":
        return {
          label: "Generating",
          className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        }
      case "ready":
        return {
          label: "Ready",
          className: "bg-green-500/10 text-green-500 border-green-500/20",
        }
      case "error":
        return {
          label: "Error",
          className: "bg-red-500/10 text-red-500 border-red-500/20",
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

interface FileTreeProps {
  files: CodeFile[]
  onFileSelect: (fileId: string) => void
  activeFile: string | null
  level?: number
}

function FileTree({ files, onFileSelect, activeFile, level = 0 }: FileTreeProps) {
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <FileTreeItem key={file.id} file={file} onFileSelect={onFileSelect} activeFile={activeFile} level={level} />
      ))}
    </div>
  )
}

interface FileTreeItemProps {
  file: CodeFile
  onFileSelect: (fileId: string) => void
  activeFile: string | null
  level: number
}

function FileTreeItem({ file, onFileSelect, activeFile, level }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(file.isOpen || false)

  const handleClick = () => {
    if (file.type === "folder") {
      setIsOpen(!isOpen)
    } else {
      onFileSelect(file.id)
    }
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer hover:bg-muted/50 transition-colors",
          activeFile === file.id && "bg-primary/10 text-primary",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {file.type === "folder" ? (
          <>
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Folder className="h-4 w-4" />
          </>
        ) : (
          <>
            <div className="w-3" />
            <FileText className="h-4 w-4" />
          </>
        )}
        <span className="truncate">{file.name}</span>
        {file.language && (
          <Badge variant="secondary" className="text-xs ml-auto">
            {file.language}
          </Badge>
        )}
      </div>

      {file.type === "folder" && isOpen && file.children && (
        <FileTree files={file.children} onFileSelect={onFileSelect} activeFile={activeFile} level={level + 1} />
      )}
    </div>
  )
}

interface CodeEditorProps {
  file: CodeFile
  onCopy: (content: string) => void
}

function CodeEditor({ file, onCopy }: CodeEditorProps) {
  return (
    <div className="flex flex-col h-full">
      {/* File Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-medium">{file.name}</span>
          <Badge variant="secondary" className="text-xs">
            {file.language}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onCopy(file.content)}>
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        </div>
      </div>

      {/* Code Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <pre className="text-sm font-mono leading-relaxed">
            <code className="language-typescript">{file.content}</code>
          </pre>
        </div>
      </ScrollArea>
    </div>
  )
}

interface PreviewPanelProps {
  previewUrl?: string
  isRunning: boolean
}

function PreviewPanel({ previewUrl, isRunning }: PreviewPanelProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span className="font-medium">Preview</span>
          {isRunning && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              Running
            </Badge>
          )}
        </div>

        {previewUrl && (
          <Button variant="ghost" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </a>
          </Button>
        )}
      </div>

      {/* Preview Content */}
      <div className="flex-1 bg-white">
        {isRunning ? (
          <iframe
            src={previewUrl || "/placeholder-preview.html"}
            className="w-full h-full border-0"
            title="Project Preview"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <Play className="h-12 w-12 mx-auto opacity-50" />
              <p>Click "Run" to start the preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Mock data
const mockFiles: CodeFile[] = [
  {
    id: "1",
    name: "src",
    path: "src",
    content: "",
    language: "",
    type: "folder",
    isOpen: true,
    children: [
      {
        id: "2",
        name: "components",
        path: "src/components",
        content: "",
        language: "",
        type: "folder",
        isOpen: true,
        children: [
          {
            id: "3",
            name: "Dashboard.tsx",
            path: "src/components/Dashboard.tsx",
            language: "tsx",
            type: "file",
            content: `import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Users, ShoppingCart, TrendingUp } from 'lucide-react'

export function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button>
          <TrendingUp className="h-4 w-4 mr-2" />
          View Analytics
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,350</div>
            <p className="text-xs text-muted-foreground">+180.1% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,234</div>
            <p className="text-xs text-muted-foreground">+19% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2%</div>
            <p className="text-xs text-muted-foreground">+0.5% from last month</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}`,
          },
          {
            id: "4",
            name: "Navigation.tsx",
            path: "src/components/Navigation.tsx",
            language: "tsx",
            type: "file",
            content: `import React from 'react'
import { Button } from '@/components/ui/button'
import { Home, Users, Settings, BarChart } from 'lucide-react'

export function Navigation() {
  return (
    <nav className="w-64 bg-card border-r border-border p-4">
      <div className="space-y-2">
        <Button variant="ghost" className="w-full justify-start">
          <Home className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <Users className="h-4 w-4 mr-2" />
          Users
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <BarChart className="h-4 w-4 mr-2" />
          Analytics
        </Button>
        <Button variant="ghost" className="w-full justify-start">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>
    </nav>
  )
}`,
          },
        ],
      },
      {
        id: "5",
        name: "pages",
        path: "src/pages",
        content: "",
        language: "",
        type: "folder",
        children: [
          {
            id: "6",
            name: "index.tsx",
            path: "src/pages/index.tsx",
            language: "tsx",
            type: "file",
            content: `import React from 'react'
import { Dashboard } from '@/components/Dashboard'
import { Navigation } from '@/components/Navigation'

export default function HomePage() {
  return (
    <div className="flex h-screen">
      <Navigation />
      <main className="flex-1 overflow-auto">
        <Dashboard />
      </main>
    </div>
  )
}`,
          },
        ],
      },
    ],
  },
  {
    id: "7",
    name: "package.json",
    path: "package.json",
    language: "json",
    type: "file",
    content: `{
  "name": "ecommerce-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.2.0"
  }
}`,
  },
]
