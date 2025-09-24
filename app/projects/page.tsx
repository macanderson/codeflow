"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plus, Play, RefreshCcw, FolderGit2 } from "lucide-react"

interface StoredProject {
  id: string
  name: string
  description?: string
  framework?: string
  language?: string
  status?: string
  repository?: {
    id?: number
    name?: string
    full_name?: string
    html_url?: string
    language?: string
  } | string
  sandboxId?: string
  createdAt?: string
  updatedAt?: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<StoredProject[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    try {
      const saved = localStorage.getItem("projects")
      if (saved) {
        setProjects(JSON.parse(saved))
      } else {
        // Fallback to current_project if list not initialized
        const current = localStorage.getItem("current_project")
        if (current) setProjects([JSON.parse(current)])
      }
    } catch (e) {
      console.warn("Failed to load projects from localStorage", e)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return projects.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      (typeof p.repository === 'string' ? p.repository : (p.repository?.full_name || p.repository?.name || "")).toLowerCase().includes(q)
    )
  }, [projects, search])

  const openProject = (p: StoredProject) => {
    localStorage.setItem("current_project", JSON.stringify(p))
    if (p.sandboxId) {
      localStorage.setItem("current_sandbox", JSON.stringify({ sessionId: p.sandboxId }))
    }
    router.push(`/project/${p.id}`)
  }

  const recreateSandbox = async (p: StoredProject) => {
    try {
      const accessToken = localStorage.getItem('github_access_token')
      const repoUrl = typeof p.repository === 'string' ? p.repository : p.repository?.html_url
      if (!repoUrl) return
      const resp = await fetch('/api/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          repo_url: repoUrl,
          branch: 'main',
          project_name: p.name,
          user_id: 'anonymous',
        })
      })
      const data = await resp.json()
      if (data?.project) {
        // Update list and current references
        const updated = projects.map(x => x.id === p.id ? { ...x, sandboxId: data.sandbox?.sessionId } : x)
        setProjects(updated)
        localStorage.setItem('projects', JSON.stringify(updated))
        localStorage.setItem('current_project', JSON.stringify(data.project))
        localStorage.setItem('current_sandbox', JSON.stringify(data.sandbox))
      }
    } catch (e) {
      console.error('Failed to recreate sandbox', e)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground">Open, switch, or create a new project.</p>
          </div>
          <Button onClick={() => router.push('/?newProject=github')}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        <div className="mb-6">
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Projects Found</CardTitle>
              <CardDescription>Connect GitHub and import a repository to get started.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/?newProject=github')}>
                <FolderGit2 className="h-4 w-4 mr-2" /> Import from GitHub
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const repoLabel = typeof p.repository === 'string' ? p.repository : (p.repository?.full_name || p.repository?.name)
              return (
                <Card key={p.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="truncate">{p.name}</CardTitle>
                    <CardDescription className="truncate">{repoLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {p.language && <Badge variant="outline">{p.language}</Badge>}
                        {p.status && <Badge variant="outline">{p.status}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => recreateSandbox(p)} title="Recreate sandbox">
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => openProject(p)}>
                          <Play className="h-4 w-4 mr-2" /> Open
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        <Separator className="my-8" />

        <div className="text-sm text-muted-foreground">
          Projects are stored locally in your browser (no server persistence yet).
        </div>
      </div>
    </div>
  )
}
