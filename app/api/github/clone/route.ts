import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest) {
  try {
    const {
      access_token,
      repo_url,
      branch = 'main',
      project_name,
      user_id,
      template = 'base'
    } = await request.json()

    if (!access_token || !repo_url || !project_name || !user_id) {
      return NextResponse.json({
        error: "Access token, repository URL, project name, and user ID are required"
      }, { status: 400 })
    }

    console.log("[GitHub Clone] Starting repository clone:", { repo_url, branch, project_name })

    // Extract owner and repo name from URL
    const urlMatch = repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!urlMatch) {
      return NextResponse.json({
        error: "Invalid GitHub repository URL"
      }, { status: 400 })
    }

    const [, owner, repo] = urlMatch

    // Get repository details from GitHub API
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

    // Create E2B sandbox
    const sbx = await Sandbox.create({
      template: template,
      apiKey: process.env.E2B_API_KEY,
    })

    const sessionId = (sbx as any).sandboxId || (sbx as any).id
    console.log("[GitHub Clone] E2B sandbox created:", sessionId)

    // Choose correct clone URL (use token for private repos)
    const cloneUrl = repoData.private
      ? `https://x-access-token:${access_token}@github.com/${owner}/${repo}.git`
      : repoData.clone_url

    // Clone the repository
    const cloneResult = await sbx.runCode(`
import subprocess
import os
import json

# Clone the repository
result = subprocess.run([
    'git', 'clone',
    '--branch', '${branch}',
    ${JSON.stringify(cloneUrl)},
    'workspace'
], capture_output=True, text=True, cwd='/home/user')

if result.returncode == 0:
    print("Repository cloned successfully")

    # List contents
    contents = subprocess.run(['ls', '-la', 'workspace'], capture_output=True, text=True, cwd='/home/user')
    print("Repository contents:")
    print(contents.stdout)

    # Check for package.json and install dependencies
    if os.path.exists('/home/user/workspace/package.json'):
        print("Found package.json, installing dependencies...")
        install_result = subprocess.run(['npm', 'install'], cwd='/home/user/workspace', capture_output=True, text=True)
        if install_result.returncode == 0:
            print("Dependencies installed successfully")
        else:
            print("Failed to install dependencies:")
            print(install_result.stderr)

    # Check for requirements.txt and install Python dependencies
    elif os.path.exists('/home/user/workspace/requirements.txt'):
        print("Found requirements.txt, installing Python dependencies...")
        install_result = subprocess.run(['pip', 'install', '-r', 'requirements.txt'], cwd='/home/user/workspace', capture_output=True, text=True)
        if install_result.returncode == 0:
            print("Python dependencies installed successfully")
        else:
            print("Failed to install Python dependencies:")
            print(install_result.stderr)

    # Get project structure
    def get_file_tree(path, prefix=""):
        tree = []
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path) and not item.startswith('.'):
                    tree.append(f"{prefix}{item}/")
                    tree.extend(get_file_tree(item_path, prefix + "  "))
                elif not item.startswith('.'):
                    tree.append(f"{prefix}{item}")
        except PermissionError:
            pass
        return tree

    project_tree = get_file_tree('/home/user/workspace')
    print("Project structure:")
    for item in project_tree[:20]:  # Limit to first 20 items
        print(item)

else:
    print("Failed to clone repository:")
    print(result.stderr)
    `)

    console.log("[GitHub Clone] Clone result:", cloneResult.logs)

    // Get initial file listing
    const fileListing = await sbx.files.list("/home/user/workspace")

    // Create project record
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const project = {
      id: projectId,
      name: project_name,
      description: repoData.description || '',
      framework: detectFramework(repoData.language),
      userId: user_id,
      githubRepo: repoData.clone_url,
      branch: branch,
      template: template,
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sandboxId: sessionId,
      repository: {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        private: repoData.private,
        html_url: repoData.html_url,
        language: repoData.language,
        stargazers_count: repoData.stargazers_count,
        forks_count: repoData.forks_count,
        updated_at: repoData.updated_at,
      },
    }

    return NextResponse.json({
      success: true,
      project,
      sandbox: {
        sessionId,
        url: `https://${sessionId}.e2b.dev`,
        status: "running",
        files: fileListing,
      },
      cloneLogs: cloneResult.logs,
    })
  } catch (error) {
    console.error("[GitHub Clone] Failed to clone repository:", error)
    return NextResponse.json({
      error: "Failed to clone repository",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

function detectFramework(language: string): string {
  const frameworkMap: { [key: string]: string } = {
    'TypeScript': 'nextjs',
    'JavaScript': 'react',
    'Python': 'fastapi',
    'Java': 'spring',
    'Go': 'gin',
    'Rust': 'actix',
    'PHP': 'laravel',
    'Ruby': 'rails',
    'C#': 'aspnet',
    'C++': 'cpp',
    'C': 'c',
  }

  return frameworkMap[language] || 'nextjs'
}
