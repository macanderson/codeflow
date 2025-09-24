import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params

    console.log("[E2B] Stopping sandbox:", sessionId)

    // Connect to existing E2B sandbox and close it
    const sbx = await Sandbox.connect(sessionId, {
      apiKey: process.env.E2B_API_KEY,
    })

    await sbx.kill()

    return NextResponse.json({
      success: true,
      status: "stopped",
      sessionId,
    })
  } catch (error) {
    console.error("[E2B] Failed to stop sandbox:", error)
    return NextResponse.json({
      error: "Failed to stop sandbox",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
