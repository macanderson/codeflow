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
        const fileContent = await sbx.files.read(path)
        result = { content: fileContent }
        break

      case 'write':
        await sbx.files.write(path, content)
        result = { message: "File written successfully" }
        break

      case 'delete':
        await sbx.files.remove(path)
        result = { message: "File deleted successfully" }
        break

      case 'move':
        await sbx.files.rename(path, newPath)
        result = { message: "File moved successfully" }
        break

      case 'create_directory':
        await sbx.files.makeDir(path)
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
