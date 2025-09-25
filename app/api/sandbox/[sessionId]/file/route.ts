import { type NextRequest } from "next/server"
import { Sandbox } from "@e2b/code-interpreter"

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")

    if (!path) {
      return new Response(JSON.stringify({ error: "Missing 'path' query param" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const sbx = await Sandbox.connect(sessionId, { apiKey: process.env.E2B_API_KEY })

    // Read file content as base64 via Python to preserve binary data
    const py = `
import base64, sys
with open(${JSON.stringify(path)}, 'rb') as f:
    data = f.read()
print(base64.b64encode(data).decode('ascii'), end='')
    `
    const res = await sbx.runCode(py)
    const base64 = ((res.logs?.stdout ?? []).join('\n') || "").trim()
    if (!base64) {
      return new Response(JSON.stringify({ error: "Failed to read file or empty file" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const buffer = Buffer.from(base64, "base64")
    const fileName = path.split("/").pop() || "download.bin"

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-cache",
    }

    return new Response(buffer, { status: 200, headers })
  } catch (error) {
    console.error("[E2B] Failed to download file:", error)
    return new Response(JSON.stringify({ error: "Failed to download file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
