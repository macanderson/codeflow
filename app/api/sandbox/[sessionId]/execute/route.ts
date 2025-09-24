import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const { command, language = 'bash' } = await request.json()

    console.log("[E2B] Executing command in sandbox:", { sessionId, command, language })

    // Connect to existing E2B sandbox
    const sbx = await Sandbox.connect(sessionId, {
      apiKey: process.env.E2B_API_KEY,
    })

    let result
    let output = ""
    let exitCode = 0

    try {
      if (language === 'python') {
        // Execute Python code
        result = await sbx.runCode(command)
        output = (result.logs?.stdout ?? []).join('\n')
        exitCode = result.error ? 1 : 0
      } else {
        // Execute shell commands
        result = await sbx.runCode(`
import subprocess
import sys

try:
    result = subprocess.run('${command.replace(/'/g, "\\'")}',
                          shell=True,
                          capture_output=True,
                          text=True,
                          cwd='/home/user/workspace' if os.path.exists('/home/user/workspace') else '/home/user')

    print("STDOUT:")
    print(result.stdout)
    if result.stderr:
        print("STDERR:")
        print(result.stderr)

    sys.exit(result.returncode)
except Exception as e:
    print(f"Error executing command: {e}")
    sys.exit(1)
        `)

        output = (result.logs?.stdout ?? []).join('\n')
        exitCode = result.error ? 1 : 0
      }
    } catch (execError) {
      console.error("[E2B] Command execution error:", execError)
      output = `Error executing command: ${execError instanceof Error ? execError.message : 'Unknown error'}`
      exitCode = 1
    }

    return NextResponse.json({
      success: true,
      output,
      exitCode,
      sessionId,
    })
  } catch (error) {
    console.error("[E2B] Failed to execute command:", error)
    return NextResponse.json({
      error: "Failed to execute command",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
