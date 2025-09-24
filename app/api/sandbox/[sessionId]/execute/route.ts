import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const { command, language = 'bash', patch, path } = await request.json()

    console.log("[E2B] Executing command in sandbox:", { sessionId, command, language })

    // Connect to existing E2B sandbox
    const sbx = await Sandbox.connect(sessionId, {
      apiKey: process.env.E2B_API_KEY,
    })
    // Ensure workspace exists
    try { await sbx.files.makeDir('/home/user/workspace') } catch {}

    let result
    let output = ""
    let exitCode = 0

    try {
      // Fast apply patch request
      if (patch && path) {
        const target = path.startsWith('/home/user/') ? path : `/home/user/workspace/${path}`
        const cwd = target.substring(0, target.lastIndexOf('/')) || '/home/user/workspace'
        const patchJson = JSON.stringify(patch)
        result = await sbx.runCode(`
import subprocess, sys, tempfile, os, json
patch_text = json.loads(${JSON.stringify(patchJson)})
fd, tmp = tempfile.mkstemp(suffix='.patch')
os.write(fd, patch_text.encode())
os.close(fd)
res = subprocess.run(['git','apply','--whitespace=nowarn', tmp], cwd='${cwd}', capture_output=True, text=True)
if res.returncode != 0:
    res = subprocess.run(['patch','-p0','-u','-i', tmp], cwd='${cwd}', capture_output=True, text=True)
print(res.stdout)
print(res.stderr)
sys.exit(res.returncode)
        `)
        output = (result.logs?.stdout ?? []).join('\n')
        exitCode = result.error ? 1 : 0
      } else if (language === 'python') {
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
