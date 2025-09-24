"use client"

import React, { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, Star, GitFork, Calendar, ExternalLink, ArrowLeft } from "lucide-react"

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

function RepositorySelectionContent() {
  const router = useRouter()
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [repositories, setRepositories] = useState<GitHubRepo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)

  useEffect(() => {
    const initializeData = async () => {
      const accessToken = localStorage.getItem('github_access_token')
      const userData = localStorage.getItem('github_user')

      if (!accessToken || !userData) {
        router.push('/')
        return
      }

      try {
        const user = JSON.parse(userData)
        setUser(user)

        // Fetch repositories
        const response = await fetch(`/api/github/repositories?access_token=${accessToken}&per_page=50`)
        const data = await response.json()

        if (data.success) {
          setRepositories(data.repositories)
        } else {
          console.error('Failed to fetch repositories:', data.error)
        }
      } catch (error) {
        console.error('Error initializing data:', error)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    initializeData()
  }, [router])

  const handleImportRepository = async (repo: GitHubRepo) => {
    setImporting(repo.id.toString())

    try {
      const accessToken = localStorage.getItem('github_access_token')

      if (!accessToken) {
        console.error('No GitHub access token found')
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
          user_id: user?.name || 'anonymous',
          template: 'base',
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Store project data
        localStorage.setItem('current_project', JSON.stringify(data.project))
        localStorage.setItem('current_sandbox', JSON.stringify(data.sandbox))

        // Redirect to project workspace
        router.push(`/project/${data.project.id}`)
      } else {
        console.error('Failed to import repository:', data.error)
        alert(`Failed to import repository: ${data.error}`)
      }
    } catch (error) {
      console.error('Repository import error:', error)
      alert('An error occurred while importing the repository')
    } finally {
      setImporting(null)
    }
  }

  const filteredRepositories = repositories.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <CardTitle>Loading Repositories...</CardTitle>
            <CardDescription>Fetching your GitHub repositories.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" onClick={() => router.push('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <img src={user?.avatar_url || "/placeholder.svg"} alt={user?.name} className="h-12 w-12 rounded-full" />
            <div>
              <h1 className="text-2xl font-bold">{user?.name}</h1>
              <p className="text-muted-foreground">@{user?.login} • {user?.public_repos} repositories</p>
            </div>
          </div>
        </div>

        {/* Repository Browser */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Repository to Import</CardTitle>
                <CardDescription>
                  Choose a repository to import and start coding with AI assistance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
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

              <ScrollArea className="h-96">
                <div className="space-y-3 pr-4">
                  {filteredRepositories.map((repo) => (
                    <div key={repo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{repo.name}</h3>
                          {repo.private && (
                            <Badge variant="secondary" className="text-xs">
                              Private
                            </Badge>
                          )}
                          {repo.language && (
                            <Badge variant="outline" className="text-xs">
                              {repo.language}
                            </Badge>
                          )}
                        </div>

                        {repo.description && <p className="text-sm text-muted-foreground">{repo.description}</p>}

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

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleImportRepository(repo)}
                          disabled={importing === repo.id.toString()}
                        >
                          {importing === repo.id.toString() ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            'Import & Start Coding'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <CardTitle>Loading...</CardTitle>
          <CardDescription>Please wait while we load your repositories.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

export default function RepositorySelectionPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <RepositorySelectionContent />
    </Suspense>
  )
}
