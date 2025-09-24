import { type NextRequest, NextResponse } from "next/server"

// In a real application, you would use a database to store projects
// For now, we'll use in-memory storage
const projects = new Map()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Get user's projects
    const userProjects = Array.from(projects.values()).filter(
      (project: any) => project.userId === userId
    )

    return NextResponse.json({
      success: true,
      projects: userProjects,
    })
  } catch (error) {
    console.error("[Projects] Failed to fetch projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      description,
      framework,
      userId,
      githubRepo,
      branch = 'main',
      template = 'base'
    } = await request.json()

    if (!name || !userId) {
      return NextResponse.json({
        error: "Project name and user ID are required"
      }, { status: 400 })
    }

    const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const project = {
      id: projectId,
      name,
      description: description || '',
      framework: framework || 'nextjs',
      userId,
      githubRepo: githubRepo || null,
      branch: branch || 'main',
      template: template || 'base',
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sandboxId: null,
    }

    projects.set(projectId, project)

    return NextResponse.json({
      success: true,
      project,
    })
  } catch (error) {
    console.error("[Projects] Failed to create project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { projectId, updates } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    const project = projects.get(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Update project
    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    projects.set(projectId, updatedProject)

    return NextResponse.json({
      success: true,
      project: updatedProject,
    })
  } catch (error) {
    console.error("[Projects] Failed to update project:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    const project = projects.get(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // If project has an active sandbox, stop it first
    if (project.sandboxId) {
      try {
        // Import here to avoid circular dependencies
        const { Sandbox } = await import('@e2b/code-interpreter')
        const sbx = await Sandbox.connect(project.sandboxId, {
          apiKey: process.env.E2B_API_KEY,
        })
        await sbx.kill()
      } catch (sandboxError) {
        console.error("[Projects] Failed to stop sandbox:", sandboxError)
        // Continue with project deletion even if sandbox stop fails
      }
    }

    projects.delete(projectId)

    return NextResponse.json({
      success: true,
      message: "Project deleted successfully",
    })
  } catch (error) {
    console.error("[Projects] Failed to delete project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
