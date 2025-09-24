import { type NextRequest, NextResponse } from "next/server"
import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest) {
  try {
    const { projectId, template, files, githubRepo, branch = 'main' } = await request.json()

    console.log("[E2B] Creating sandbox:", { projectId, template, githubRepo, branch })

    // Create E2B sandbox
    const sbx = await Sandbox.create(projectId, {
      accessToken: process.env.E2B_ACCESS_TOKEN,
      // name: projectId,
      // template: template || 'base', // Use base template if none specified
      apiKey: process.env.E2B_API_KEY,
    })

    const sessionId = sbx.sandboxId
    console.log("[E2B] Sandbox created with ID:", sessionId)

    // If GitHub repository is provided, clone it
    if (githubRepo) {
      try {
        console.log("[E2B] Cloning GitHub repository:", githubRepo)

        // Clone the repository
        const cloneResult = await sbx.runCode(`
import subprocess
import os

# Clone the repository
result = subprocess.run([
    'git', 'clone',
    '${githubRepo}',
    'workspace'
], capture_output=True, text=True, cwd='/home/user')

if result.returncode == 0:
    print("Repository cloned successfully")
    # List contents
    contents = subprocess.run(['ls', '-la', 'workspace'], capture_output=True, text=True, cwd='/home/user')
    print("Repository contents:")
    print(contents.stdout)
else:
    print("Failed to clone repository:")
    print(result.stderr)
        `)

        console.log("[E2B] Clone result:", cloneResult.logs)

        // Check if package.json exists and install dependencies
        const checkPackageResult = await sbx.runCode(`
import os
import subprocess

if os.path.exists('/home/user/workspace/package.json'):
    print("Found package.json, installing dependencies...")
    result = subprocess.run(['npm', 'install'], cwd='/home/user/workspace', capture_output=True, text=True)
    if result.returncode == 0:
        print("Dependencies installed successfully")
    else:
        print("Failed to install dependencies:")
        print(result.stderr)
else:
    print("No package.json found")
        `)

        console.log("[E2B] Package installation:", checkPackageResult.logs)

      } catch (cloneError) {
        console.error("[E2B] Failed to clone repository:", cloneError)
        // Continue with sandbox creation even if clone fails
      }
    }

    // If files are provided, write them to the sandbox
    if (files && Array.isArray(files)) {
      try {
        console.log("[E2B] Writing files to sandbox:", files.length)

        for (const file of files) {
          if (file.path && file.content !== undefined) {
            await sbx.files.write(file.path, file.content)
          }
        }

        console.log("[E2B] Files written successfully")
      } catch (fileError) {
        console.error("[E2B] Failed to write files:", fileError)
      }
    }

    // Get initial file listing
    const fileListing = await sbx.files.list("/")
    console.log("[E2B] Initial file listing:", fileListing)

    return NextResponse.json({
      success: true,
      sessionId,
      url: `https://${sessionId}.e2b.dev`,
      status: "running",
      files: fileListing,
      githubRepo: githubRepo || null,
      branch: branch || 'main',
    })
  } catch (error) {
    console.error("[E2B] Failed to create sandbox:", error)
    return NextResponse.json({
      error: "Failed to create sandbox",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
