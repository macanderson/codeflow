import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from '@e2b/code-interpreter'

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || '/'

    console.log("[E2B] Listing files in sandbox:", { sessionId, path })

    // Connect to existing E2B sandbox
    const sbx = await Sandbox.connect(sessionId, {
      apiKey: process.env.E2B_API_KEY,
    })

    // Ensure workspace exists; create if missing (first-time clones)
    try {
      await sbx.files.makeDir('/home/user/workspace')
    } catch {}
    const files = await sbx.files.list(path)

    return NextResponse.json({
      success: true,
      files,
      path,
      sessionId,
    })
  } catch (error) {
    console.error("[E2B] Failed to list files:", error)
    return NextResponse.json({
      error: "Failed to list files",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const { action, path, content, newPath } = await request.json()

    console.log("[E2B] File operation in sandbox:", { sessionId, action, path })

    // Connect to existing E2B sandbox
    const sbx = await Sandbox.connect(sessionId, {
      apiKey: process.env.E2B_API_KEY,
    })

    let result

    switch (action) {
      case 'read':
        // Normalize path: allow absolute and workspace-relative
        const readPath = path.startsWith('/home/user/') ? path : `/home/user/workspace/${path}`
        const fileContent = await sbx.files.read(readPath)
        result = { content: fileContent }
        break

      case 'write':
        {
          const writePath = path.startsWith('/home/user/') ? path : `/home/user/workspace/${path}`
          // Ensure parent directory exists before writing
          try {
            const dir = writePath.substring(0, writePath.lastIndexOf('/')) || '/home/user/workspace'
            await sbx.files.makeDir(dir)
          } catch {}
          await sbx.files.write(writePath, content)
        }
        result = { message: "File written successfully" }
        break

      case 'delete':
        {
          const delPath = path.startsWith('/home/user/') ? path : `/home/user/workspace/${path}`
          await sbx.files.remove(delPath)
        }
        result = { message: "File deleted successfully" }
        break

      case 'move':
        {
          const from = path.startsWith('/home/user/') ? path : `/home/user/workspace/${path}`
          const to = newPath?.startsWith('/home/user/') ? newPath : `/home/user/workspace/${newPath}`
          await sbx.files.rename(from, to)
        }
        result = { message: "File moved successfully" }
        break

      case 'create_directory':
        {
          const dir = path.startsWith('/home/user/') ? path : `/home/user/workspace/${path}`
          await sbx.files.makeDir(dir)
        }
        result = { message: "Directory created successfully" }
        break

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      result,
      sessionId,
    })
  } catch (error) {
    console.error("[E2B] Failed to perform file operation:", error)
    return NextResponse.json({
      error: "Failed to perform file operation",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
