"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Github, Search, Star, GitFork, Calendar, ExternalLink, Plus, Check } from "lucide-react"

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string
  private: boolean
  html_url: string
  stargazers_count: number
  forks_count: number
  language: string
  updated_at: string
  default_branch: string
}

interface GitHubUser {
  login: string
  avatar_url: string
  name: string
  public_repos: number
}

export function GitHubIntegration() {
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [repositories, setRepositories] = useState<GitHubRepo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)

  // Real GitHub connection using OAuth
  const handleConnectGitHub = async () => {
    setLoading(true)
    try {
      // Get GitHub OAuth URL
      const response = await fetch('/api/github/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'get_auth_url' }),
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to GitHub OAuth
        window.location.href = data.auth_url
      } else {
        console.error('Failed to get GitHub auth URL:', data.error)
        setLoading(false)
      }
    } catch (error) {
      console.error('GitHub connection error:', error)
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setUser(null)
    setRepositories([])
    setSelectedRepo(null)
    localStorage.removeItem('github_access_token')
  }

  // Fetch repositories from GitHub API
  const fetchRepositories = async (accessToken: string) => {
    try {
      const response = await fetch(`/api/github/repositories?access_token=${accessToken}&per_page=50`)
      const data = await response.json()

      if (data.success) {
        setRepositories(data.repositories)
      } else {
        console.error('Failed to fetch repositories:', data.error)
      }
    } catch (error) {
      console.error('Error fetching repositories:', error)
    }
  }

  // Check for existing GitHub connection on component mount
  React.useEffect(() => {
    const accessToken = localStorage.getItem('github_access_token')
    const userData = localStorage.getItem('github_user')

    if (accessToken && userData) {
      try {
        const user = JSON.parse(userData)
        setIsConnected(true)
        setUser(user)
        fetchRepositories(accessToken)
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        localStorage.removeItem('github_access_token')
        localStorage.removeItem('github_user')
      }
    }
  }, [])

  const handleImportRepository = async (repo: GitHubRepo) => {
    setSelectedRepo(repo)
    setLoading(true)

    try {
      // Get access token from localStorage (set during OAuth callback)
      const accessToken = localStorage.getItem('github_access_token')

      if (!accessToken) {
        console.error('No GitHub access token found')
        setLoading(false)
        return
      }

      // Clone repository and create project
      const response = await fetch('/api/github/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          repo_url: repo.html_url,
          branch: repo.default_branch,
          project_name: repo.name,
          user_id: user?.login || 'anonymous',
          template: 'base',
        }),
      })

      const data = await response.json()

      if (data.success) {
        console.log('Repository imported successfully:', data.project)
        // Store project data and redirect to project workspace
        localStorage.setItem('current_project', JSON.stringify(data.project))
        localStorage.setItem('current_sandbox', JSON.stringify(data.sandbox))
        try {
          const listRaw = localStorage.getItem('projects')
          const list = listRaw ? JSON.parse(listRaw) : []
          const existsIdx = list.findIndex((p: any) => p.id === data.project.id)
          if (existsIdx >= 0) list[existsIdx] = data.project
          else list.unshift(data.project)
          localStorage.setItem('projects', JSON.stringify(list))
        } catch {}
        window.location.href = `/project/${data.project.id}`
      } else {
        console.error('Failed to import repository:', data.error)
      }
    } catch (error) {
      console.error('Repository import error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRepositories = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (!isConnected) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Github className="h-6 w-6" />
          </div>
          <CardTitle>Connect to GitHub</CardTitle>
          <CardDescription>Connect your GitHub account to import repositories and sync your code.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleConnectGitHub} disabled={loading}>
            <Github className="h-4 w-4 mr-2" />
            {loading ? "Connecting..." : "Connect GitHub Account"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connected Account Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={user?.avatar_url || "/placeholder.svg"} alt={user?.name} className="h-10 w-10 rounded-full" />
              <div>
                <CardTitle className="text-lg">{user?.name}</CardTitle>
                <CardDescription>
                  @{user?.login} • {user?.public_repos} repositories
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                <Check className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Repository Browser */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Repositories</CardTitle>
              <CardDescription>
                Browse and import your GitHub repositories to start coding with AI assistance.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Import Repository
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Import Repository</DialogTitle>
                  <DialogDescription>
                    Select a repository to import and start working with your AI coding assistant.
                  </DialogDescription>
                </DialogHeader>
                <RepositoryBrowser
                  repositories={filteredRepositories}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onImport={handleImportRepository}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-3 pr-4">
                {filteredRepositories.map((repo) => (
                  <RepositoryCard key={repo.id} repository={repo} onImport={() => handleImportRepository(repo)} />
                ))}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface RepositoryCardProps {
  repository: GitHubRepo
  onImport: () => void
}

function RepositoryCard({ repository, onImport }: RepositoryCardProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{repository.name}</h3>
          {repository.private && (
            <Badge variant="secondary" className="text-xs">
              Private
            </Badge>
          )}
          {repository.language && (
            <Badge variant="outline" className="text-xs">
              {repository.language}
            </Badge>
          )}
        </div>

        {repository.description && <p className="text-sm text-muted-foreground">{repository.description}</p>}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3" />
            {repository.stargazers_count}
          </div>
          <div className="flex items-center gap-1">
            <GitFork className="h-3 w-3" />
            {repository.forks_count}
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(repository.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href={repository.html_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        <Button size="sm" onClick={onImport}>
          Import
        </Button>
      </div>
    </div>
  )
}

interface RepositoryBrowserProps {
  repositories: GitHubRepo[]
  searchQuery: string
  onSearchChange: (query: string) => void
  onImport: (repo: GitHubRepo) => void
}

function RepositoryBrowser({ repositories, searchQuery, onSearchChange, onImport }: RepositoryBrowserProps) {
  return (
    <Tabs defaultValue="personal" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="personal">Your Repositories</TabsTrigger>
        <TabsTrigger value="organizations">Organizations</TabsTrigger>
      </TabsList>

      <TabsContent value="personal" className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your repositories..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-3 pr-4">
            {repositories.map((repo) => (
              <RepositoryCard key={repo.id} repository={repo} onImport={() => onImport(repo)} />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="organizations" className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          <Github className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No organization repositories found.</p>
        </div>
      </TabsContent>
    </Tabs>
  )
}

// Mock data for demonstration
const mockRepositories: GitHubRepo[] = [
  {
    id: 1,
    name: "ecommerce-dashboard",
    full_name: "johndoe/ecommerce-dashboard",
    description: "Modern e-commerce dashboard built with Next.js and TypeScript",
    private: false,
    html_url: "https://github.com/johndoe/ecommerce-dashboard",
    stargazers_count: 42,
    forks_count: 8,
    language: "TypeScript",
    updated_at: "2024-01-15T10:30:00Z",
    default_branch: "main",
  },
]
