import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accessToken = searchParams.get('access_token')
    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('per_page') || '30'
    const type = searchParams.get('type') || 'all' // all, owner, public, private

    if (!accessToken) {
      return NextResponse.json({ error: "Access token required" }, { status: 401 })
    }

    // Fetch user repositories from GitHub API
    const response = await fetch(
      `https://api.github.com/user/repos?type=${type}&page=${page}&per_page=${perPage}&sort=updated`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({ 
        error: errorData.message || "Failed to fetch repositories" 
      }, { status: response.status })
    }

    const repositories = await response.json()

    // Transform the data to match our frontend interface
    const transformedRepos = repositories.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      language: repo.language,
      updated_at: repo.updated_at,
      default_branch: repo.default_branch,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url,
    }))

    return NextResponse.json({
      success: true,
      repositories: transformedRepos,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(perPage),
        total: repositories.length,
      },
    })
  } catch (error) {
    console.error("[GitHub Repositories] Error:", error)
    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { access_token, repo_url, branch = 'main' } = await request.json()

    if (!access_token || !repo_url) {
      return NextResponse.json({ 
        error: "Access token and repository URL are required" 
      }, { status: 400 })
    }

    // Extract owner and repo name from URL
    const urlMatch = repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!urlMatch) {
      return NextResponse.json({ 
        error: "Invalid GitHub repository URL" 
      }, { status: 400 })
    }

    const [, owner, repo] = urlMatch

    // Get repository details
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!repoResponse.ok) {
      const errorData = await repoResponse.json()
      return NextResponse.json({ 
        error: errorData.message || "Repository not found or access denied" 
      }, { status: repoResponse.status })
    }

    const repoData = await repoResponse.json()

    // Get repository contents (files and folders)
    const contentsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!contentsResponse.ok) {
      return NextResponse.json({ 
        error: "Failed to fetch repository contents" 
      }, { status: contentsResponse.status })
    }

    const contents = await contentsResponse.json()

    return NextResponse.json({
      success: true,
      repository: {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        private: repoData.private,
        html_url: repoData.html_url,
        clone_url: repoData.clone_url,
        ssh_url: repoData.ssh_url,
        default_branch: repoData.default_branch,
        language: repoData.language,
        stargazers_count: repoData.stargazers_count,
        forks_count: repoData.forks_count,
        updated_at: repoData.updated_at,
      },
      contents,
      branch,
    })
  } catch (error) {
    console.error("[GitHub Repository Details] Error:", error)
    return NextResponse.json({ error: "Failed to fetch repository details" }, { status: 500 })
  }
}