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
import subprocess, sys, os
result = subprocess.run(${JSON.stringify(cmd)}, shell=True, cwd=${JSON.stringify(cwd)}, capture_output=True, text=True)
print(result.stdout, end='')
if result.stderr:
    print(result.stderr, end='', file=sys.stderr)
sys.exit(result.returncode)
      `
      const res = await sbx.runCode(py)
      const stdout = (res.logs?.stdout ?? []).join('\n')
      const stderr = (res.logs?.stderr ?? []).join('\n')
      const exitCode = res.error ? 1 : 0
      return { stdout, stderr, exitCode }
    },

    async readFile(path: string) {
      return await sbx.files.read(path)
    },

    async writeFile(path: string, content: string) {
      await sbx.files.write(path, content)
    },

    async applyPatch(patch: string, opts?: { cwd?: string }) {
      const cwd = opts?.cwd ?? WORKSPACE_DIR
      // Write patch to a temp file and try to apply with `git apply` then fallback to `patch`
      const py = `
import os, subprocess, tempfile, textwrap, sys
patch_text = textwrap.dedent('''\
${patch.replace(/\\/g, '\\\\').replace(/`/g, '\`').replace(/\$/g, '\\$').replace(/\/\/\//g, '\/\/\/')}''')
fd, tmp = tempfile.mkstemp(suffix='.patch')
os.write(fd, patch_text.encode())
os.close(fd)

def run(cmd):
    return subprocess.run(cmd, cwd='${cwd}', capture_output=True, text=True)

res = run(['git', 'apply', '--whitespace=nowarn', tmp])
if res.returncode != 0:
    res = run(['patch', '-p0', '-u', '-i', tmp])

print(res.stdout, end='')
if res.stderr:
    print(res.stderr, end='', file=sys.stderr)
sys.exit(res.returncode)
      `
      const res = await sbx.runCode(py)
      const stdout = (res.logs?.stdout ?? []).join('\n')
      const stderr = (res.logs?.stderr ?? []).join('\n')
      const exitCode = res.error ? 1 : 0
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
  return (res.stdout ?? '') + (res.stderr ?? '')
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
  const cmd = `npm i -D ${pkgs.join(' ')}`
  const res = await sbx.run(cmd, { cwd: WORKSPACE_DIR })
  return (res.stdout ?? '') + (res.stderr ?? '')
}
