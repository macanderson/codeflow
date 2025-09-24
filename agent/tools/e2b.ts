import { Sandbox } from '@e2b/code-interpreter'

// Canonical workspace path inside the E2B code-interpreter sandbox
const WORKSPACE_DIR = '/home/user/workspace'

type SandboxWrapper = {
  run: (cmd: string, opts?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  applyPatch?: (patch: string, opts?: { cwd?: string }) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  files: {
    list: (path: string) => Promise<any>
    write: (path: string, content: string) => Promise<void>
    read: (path: string) => Promise<string>
  }
}

async function wrapSandbox(sbx: any): Promise<SandboxWrapper> {

  // Ensure workspace directory exists
  await sbx.runCode(`
import os
os.makedirs('${WORKSPACE_DIR}', exist_ok=True)
print('Workspace ready: ${WORKSPACE_DIR}')
  `)

  const wrapper: SandboxWrapper = {
    async run(cmd: string, opts?: { cwd?: string }) {
      const cwd = opts?.cwd ?? WORKSPACE_DIR
      const py = `
import subprocess, os
result = subprocess.run(${JSON.stringify(cmd)}, shell=True, cwd=${JSON.stringify(cwd)}, capture_output=True, text=True)
if result.stdout:
    print(result.stdout, end='')
if result.stderr:
    print(result.stderr, end='')
print("\n__EXIT_CODE__=%d" % result.returncode)
      `
      const res = await sbx.runCode(py)
      const rawOut = (res.logs?.stdout ?? []).join('\n')
      const rawErr = (res.logs?.stderr ?? []).join('\n')
      const combined = [rawOut, rawErr].filter(Boolean).join('\n')
      const match = combined.match(/__EXIT_CODE__=(\d+)/)
      const exitCode = match ? parseInt(match[1], 10) : 0
      const stripMarker = (text: string) => text.replace(/\n?__EXIT_CODE__=\d+\s*$/m, '')
      const stdout = stripMarker(rawOut)
      const stderr = stripMarker(rawErr)
      return { stdout, stderr, exitCode }
    },

    async readFile(path: string) {
      const abs = path.startsWith('/home/user/') ? path : `${WORKSPACE_DIR}/${path}`
      return await sbx.files.read(abs)
    },

    async writeFile(path: string, content: string) {
      const abs = path.startsWith('/home/user/') ? path : `${WORKSPACE_DIR}/${path}`
      // Ensure parent directory exists before writing
      try {
        const dir = abs.substring(0, abs.lastIndexOf('/')) || WORKSPACE_DIR
        await sbx.run(`mkdir -p ${JSON.stringify(dir)}`)
      } catch {}
      await sbx.files.write(abs, content)
    },

    async applyPatch(patch: string, opts?: { cwd?: string }) {
      const cwd = opts?.cwd ?? WORKSPACE_DIR
      // Write patch to a temp file and try to apply with `git apply` then fallback to `patch`
      const py = `
import os, subprocess, tempfile, textwrap
patch_text = textwrap.dedent('''\
${patch.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\/\/\//g, '\/\/\/')}''')
fd, tmp = tempfile.mkstemp(suffix='.patch')
os.write(fd, patch_text.encode())
os.close(fd)

def run(cmd):
    return subprocess.run(cmd, cwd='${cwd}', capture_output=True, text=True)

res = run(['git', 'apply', '--whitespace=nowarn', tmp])
if res.returncode != 0:
    res = run(['patch', '-p0', '-u', '-i', tmp])

if res.stdout:
    print(res.stdout, end='')
if res.stderr:
    print(res.stderr, end='')
print("\n__EXIT_CODE__=%d" % res.returncode)
      `
      const res = await sbx.runCode(py)
      const rawOut = (res.logs?.stdout ?? []).join('\n')
      const rawErr = (res.logs?.stderr ?? []).join('\n')
      const combined = [rawOut, rawErr].filter(Boolean).join('\n')
      const match = combined.match(/__EXIT_CODE__=(\d+)/)
      const exitCode = match ? parseInt(match[1], 10) : 0
      const stripMarker = (text: string) => text.replace(/\n?__EXIT_CODE__=\d+\s*$/m, '')
      const stdout = stripMarker(rawOut)
      const stderr = stripMarker(rawErr)
      return { stdout, stderr, exitCode }
    },

    files: {
      list: (path: string) => sbx.files.list(path),
      write: async (path: string, content: string) => { await sbx.files.write(path, content) },
      read: (path: string) => sbx.files.read(path),
    },
  }

  return wrapper
}

export async function createSandbox(): Promise<SandboxWrapper> {
  const template = 'codeflow-agent'
  console.log("[E2B] Creating sandbox:", template)
  const sbx = await Sandbox.create(template, {
    apiKey: process.env.E2B_API_KEY,
  })
  console.log("[E2B] Sandbox created:", sbx.sandboxId)
  return await wrapSandbox(sbx)

}

export async function connectSandbox(sessionId: string): Promise<SandboxWrapper> {
  console.log("[E2B] Connecting to sandbox:", sessionId)
  const sbx = await Sandbox.connect(sessionId, { apiKey: process.env.E2B_API_KEY })
  console.log("[E2B] Sandbox connected:", sbx.sandboxId)
  return await wrapSandbox(sbx)
}

export async function runCmd(sbx: SandboxWrapper, cmd: string, cwd?: string) {
  console.log("[E2B] Running command:", cmd)
  const res = await sbx.run(cmd, { cwd })
  const stdout = res.stdout ?? ''
  const stderr = res.stderr ?? ''
  if (res.exitCode !== 0) {
    throw new Error(`Command failed (exit ${res.exitCode}): ${stderr || stdout}`)
  }
  return stdout || stderr
}

export async function readFile(sbx: SandboxWrapper, path: string) {
  console.log("[E2B] Reading file:", path)
  return await sbx.readFile(path)
}

export async function writeFile(sbx: SandboxWrapper, path: string, content: string) {
  console.log("[E2B] Writing file:", path)
  await sbx.writeFile(path, content)
}

export async function installPkgs(sbx: SandboxWrapper, pkgs: string[]) {
  console.log("[E2B] Installing packages:", pkgs)
  // Ensure pnpm is available and install dev dependencies using pnpm
  const cmd = `bash -lc "corepack enable >/dev/null 2>&1 || true; corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true; pnpm add -D ${pkgs.join(' ')}"`
  const res = await sbx.run(cmd, { cwd: WORKSPACE_DIR })
  return (res.stdout ?? '') + (res.stderr ?? '')
}
