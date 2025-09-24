import { type NextRequest, NextResponse } from "next/server"
import 'dotenv/config'
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest) {
  try {
    const { projectId, template, files, githubRepo, branch = 'main' } = await request.json()

    console.log("[E2B] Creating sandbox:", { projectId, template, githubRepo, branch })

    // Create E2B sandbox with timeout
    const sbx = await Sandbox.create(projectId, {
      accessToken: process.env.E2B_ACCESS_TOKEN,
      // name: projectId,
      // template: template || 'base', // Use base template if none specified
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 60000, // 60 seconds timeout
    })

    // Set additional timeout for operations
    await sbx.setTimeout(120000) // 2 minutes for operations

    const sessionId = sbx.sandboxId
    console.log("[E2B] Sandbox created with ID:", sessionId)

    // If GitHub repository is provided, clone it
    if (githubRepo) {
      try {
        console.log("[E2B] Cloning GitHub repository:", githubRepo)

        // Clone the repository with timeout
        const cloneResult = await sbx.runCode(`
import subprocess
import os
import sys

# Set git config for better performance
subprocess.run(['git', 'config', '--global', 'http.postBuffer', '524288000'], capture_output=True)

print("Starting repository clone...")
sys.stdout.flush()

# Clone the repository with timeout
try:
    result = subprocess.run([
        'git', 'clone',
        '--depth', '1',  # Shallow clone for speed
        '${githubRepo}',
        'workspace'
    ], capture_output=True, text=True, cwd='/home/user', timeout=60)
except subprocess.TimeoutExpired:
    print("Clone operation timed out")
    result = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="Clone timed out")

if result.returncode == 0:
    print("Repository cloned successfully")
    # List contents
    contents = subprocess.run(['ls', '-la', 'workspace'], capture_output=True, text=True, cwd='/home/user')
    print("Repository contents:")
    print(contents.stdout)
else:
    print("Failed to clone repository:")
    print(result.stderr)
        `, { timeoutMs: 90000 })  // 1.5 minutes timeout // 1.5 minutes timeout

        console.log("[E2B] Clone result:", cloneResult.logs)

        // Check if package.json exists and install dependencies
        const checkPackageResult = await sbx.runCode(`
import os
import subprocess
import json
import sys

def install_package_manager(pm_name, install_cmd):
    """Helper to install a package manager if not present."""
    try:
        # Check if package manager exists
        check = subprocess.run([pm_name, '--version'], capture_output=True, text=True)
        if check.returncode == 0:
            print(f"{pm_name} is already installed: {check.stdout.strip()}")
            return True
    except:
        pass

    print(f"Installing {pm_name}...")
    sys.stdout.flush()

    try:
        if pm_name == 'pnpm':
            # Install pnpm using the official installation script
            install_result = subprocess.run(
                ['sh', '-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -'],
                capture_output=True, text=True, timeout=30
            )
            if install_result.returncode == 0:
                # Add to PATH for current session
                os.environ['PATH'] = f"/home/user/.local/share/pnpm:{os.environ['PATH']}"
                print(f"{pm_name} installed successfully")
                return True
        elif pm_name == 'yarn':
            # Install yarn using npm
            install_result = subprocess.run(
                ['npm', 'install', '-g', 'yarn'],
                capture_output=True, text=True, timeout=30
            )
            if install_result.returncode == 0:
                print(f"{pm_name} installed successfully")
                return True
    except Exception as e:
        print(f"Failed to install {pm_name}: {e}")

    return False

if os.path.exists('/home/user/workspace/package.json'):
    print("Found package.json, analyzing project...")
    sys.stdout.flush()

    # Read package.json to check for packageManager field
    package_manager = None
    install_cmd = None

    try:
        with open('/home/user/workspace/package.json', 'r') as f:
            package_json = json.load(f)

            # Check for packageManager field (e.g., "pnpm@8.0.0")
            if 'packageManager' in package_json:
                pm_spec = package_json['packageManager']
                pm_name = pm_spec.split('@')[0]
                print(f"Package manager specified in package.json: {pm_name}")

                if pm_name == 'pnpm':
                    install_package_manager('pnpm', None)
                    package_manager = 'pnpm'
                    install_cmd = ['pnpm', 'install']
                elif pm_name == 'yarn':
                    install_package_manager('yarn', None)
                    package_manager = 'yarn'
                    install_cmd = ['yarn', 'install']
                elif pm_name == 'npm':
                    package_manager = 'npm'
                    install_cmd = ['npm', 'install', '--legacy-peer-deps']
    except Exception as e:
        print(f"Error reading package.json: {e}")

    # If no packageManager field, check lock files
    if not package_manager:
        if os.path.exists('/home/user/workspace/pnpm-lock.yaml'):
            print("Detected pnpm-lock.yaml")
            install_package_manager('pnpm', None)
            package_manager = 'pnpm'
            install_cmd = ['pnpm', 'install']
        elif os.path.exists('/home/user/workspace/yarn.lock'):
            print("Detected yarn.lock")
            install_package_manager('yarn', None)
            package_manager = 'yarn'
            install_cmd = ['yarn', 'install']
        elif os.path.exists('/home/user/workspace/package-lock.json'):
            print("Detected package-lock.json")
            package_manager = 'npm'
            install_cmd = ['npm', 'ci', '--legacy-peer-deps']
        else:
            # Default to pnpm LTS as specified
            print("No lock file detected, defaulting to pnpm LTS")
            install_package_manager('pnpm', None)
            package_manager = 'pnpm'
            install_cmd = ['pnpm', 'install']

    # Install dependencies
    if install_cmd:
        print(f"Installing dependencies with {package_manager}...")
        sys.stdout.flush()

        try:
            # Update PATH for pnpm if needed
            if package_manager == 'pnpm':
                os.environ['PATH'] = f"/home/user/.local/share/pnpm:{os.environ['PATH']}"

            result = subprocess.run(
                install_cmd,
                cwd='/home/user/workspace',
                capture_output=True,
                text=True,
                timeout=120,
                env=os.environ
            )

            if result.returncode == 0:
                print(f"✅ Dependencies installed successfully with {package_manager}")
                # List installed packages summary
                if os.path.exists('/home/user/workspace/node_modules'):
                    count = len(os.listdir('/home/user/workspace/node_modules'))
                    print(f"📦 Installed {count} packages")
            else:
                print(f"⚠️ Failed to install dependencies with {package_manager}:")
                print(result.stderr[:1000])  # Limit error output
        except subprocess.TimeoutExpired:
            print("⏱️ Dependency installation timed out after 2 minutes")
        except Exception as e:
            print(f"❌ Error during installation: {e}")
else:
    print("No package.json found in repository")  // 2.5 minutes timeout
        `, { timeoutMs: 150000 })

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
