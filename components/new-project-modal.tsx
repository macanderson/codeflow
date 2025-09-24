"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Github,
  Search,
  Star,
  GitFork,
  Calendar,
  ExternalLink,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Monitor,
  Code,
  FileText
} from "lucide-react"

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

interface NewProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ModalStep = 'auth' | 'repositories' | 'importing' | 'success'

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<ModalStep>('auth')
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [repositories, setRepositories] = useState<GitHubRepo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [projectData, setProjectData] = useState<any>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setUser(null)
      setRepositories([])
      setSearchQuery("")
      setSelectedRepo(null)
      setLoading(false)
      setImporting(false)
      setProjectData(null)
      // Don't set currentStep here - let the auth check handle it
    }
  }, [open])

  // Check for existing GitHub connection
  useEffect(() => {
    if (open) {
      const accessToken = localStorage.getItem('github_access_token')
      const userData = localStorage.getItem('github_user')

      if (accessToken && userData) {
        try {
          const user = JSON.parse(userData)
          setUser(user)
          setCurrentStep('repositories')
          fetchRepositories(accessToken)
        } catch (error) {
          console.error('Error parsing stored user data:', error)
          localStorage.removeItem('github_access_token')
          localStorage.removeItem('github_user')
          setCurrentStep('auth')
        }
      } else {
        setCurrentStep('auth')
      }
    }
  }, [open])

  // Listen for storage changes (when auth completes in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'github_access_token' && e.newValue && open && currentStep === 'auth') {
        const userData = localStorage.getItem('github_user')
        if (userData) {
          try {
            const user = JSON.parse(userData)
            setUser(user)
            setCurrentStep('repositories')
            fetchRepositories(e.newValue)
          } catch (error) {
            console.error('Error parsing stored user data:', error)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [open, currentStep])

  const handleGitHubAuth = async () => {
    setLoading(true)
    try {
      console.log('Getting GitHub auth URL')
      const response = await fetch('/api/github/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_auth_url' })
      })

      const data = await response.json()
      console.log('GitHub auth data:', data)
      if (data.success) {
        console.log('GitHub auth URL:', data.auth_url)
        // Store state for callback
        localStorage.setItem('github_auth_state', data.state)
        localStorage.setItem('github_auth_return_url', window.location.href)

        // Redirect to GitHub OAuth
        console.log('Redirecting to GitHub OAuth')
        window.location.href = data.auth_url
      } else {
        console.error('Failed to get GitHub auth URL:', data.error)
        setLoading(false)
      }
    } catch (error) {
      console.error('GitHub auth error:', error)
      setLoading(false)
    }
  }

  const fetchRepositories = async (accessToken: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/github/repositories?access_token=${accessToken}&per_page=50`)
      const data = await response.json()

      if (data.success) {
        setRepositories(data.repositories)
      } else {
        console.error('Failed to fetch repositories:', data.error)
      }
    } catch (error) {
      console.error('Error fetching repositories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportRepository = async (repo: GitHubRepo) => {
    setSelectedRepo(repo)
    setImporting(true)
    setCurrentStep('importing')

    try {
      const accessToken = localStorage.getItem('github_access_token')

      if (!accessToken) {
        console.error('No GitHub access token found')
        return
      }

      // Clone repository and create project
      const response = await fetch('/api/github/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        setProjectData(data)
        setCurrentStep('success')

        // Store project data
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
      } else {
        console.error('Failed to import repository:', data.error)
        setCurrentStep('repositories')
      }
    } catch (error) {
      console.error('Repository import error:', error)
      setCurrentStep('repositories')
    } finally {
      setImporting(false)
    }
  }

  const handleOpenProject = () => {
    if (projectData) {
      onOpenChange(false)
      router.push(`/project/${projectData.project.id}`)
    }
  }

  const filteredRepositories = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const renderAuthStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Github className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Connect to GitHub</h3>
          <p className="text-sm text-muted-foreground">
            Authorize with GitHub to import your repositories and start coding with AI assistance.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Button
          className="w-full"
          onClick={handleGitHubAuth}
          disabled={loading}
          size="lg"
        >
          <Github className="h-4 w-4 mr-2" />
          {loading ? "Connecting..." : "Connect GitHub Account"}
        </Button>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            You'll be redirected to GitHub to authorize the application
          </p>
        </div>
      </div>
    </div>
  )

  const handleDisconnect = () => {
    localStorage.removeItem('github_access_token')
    localStorage.removeItem('github_user')
    setUser(null)
    setRepositories([])
    setCurrentStep('auth')
  }

  const renderRepositoriesStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={user?.avatar_url || "/placeholder.svg"} alt={user?.name} className="h-10 w-10 rounded-full" />
          <div>
            <h3 className="font-semibold">{user?.name}</h3>
            <p className="text-sm text-muted-foreground">@{user?.login} • {user?.public_repos} repositories</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-80">
          <div className="space-y-3 pr-4">
            {filteredRepositories.map((repo) => (
              <Card
                key={repo.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleImportRepository(repo)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{repo.name}</h4>
                        {repo.private && (
                          <Badge variant="secondary" className="text-xs">Private</Badge>
                        )}
                        {repo.language && (
                          <Badge variant="outline" className="text-xs">{repo.language}</Badge>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repo.stargazers_count}
                        </div>
                        <div className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {repo.forks_count}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(repo.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  const renderImportingStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Importing Repository</h3>
        <p className="text-sm text-muted-foreground">
          Cloning {selectedRepo?.name} and setting up your development environment...
        </p>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Creating E2B sandbox</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Cloning repository</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Installing dependencies</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          <span>Setting up project workspace</span>
        </div>
      </div>
    </div>
  )

  const renderSuccessStep = () => (
    <div className="space-y-6 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">Project Ready!</h3>
        <p className="text-sm text-muted-foreground">
          {selectedRepo?.name} has been successfully imported and is ready for development.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Code className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Chat Interface</span>
          </div>
          <p className="text-xs text-muted-foreground">AI-powered coding assistant</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">File Explorer</span>
          </div>
          <p className="text-xs text-muted-foreground">Browse and edit files</p>
        </Card>
      </div>

      <Button onClick={handleOpenProject} className="w-full" size="lg">
        <Monitor className="h-4 w-4 mr-2" />
        Open Project Workspace
      </Button>
    </div>
  )

  const getStepTitle = () => {
    switch (currentStep) {
      case 'auth': return 'Connect to GitHub'
      case 'repositories': return 'Select Repository'
      case 'importing': return 'Importing Project'
      case 'success': return 'Project Ready'
      default: return 'New Project'
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 'auth': return 'Authorize with GitHub to access your repositories'
      case 'repositories': return 'Choose a repository to import and start coding'
      case 'importing': return 'Setting up your development environment'
      case 'success': return 'Your project is ready for development'
      default: return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[60vh]">
          {currentStep === 'auth' && renderAuthStep()}
          {currentStep === 'repositories' && renderRepositoriesStep()}
          {currentStep === 'importing' && renderImportingStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </div>

        {currentStep === 'repositories' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
