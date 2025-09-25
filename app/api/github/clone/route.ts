import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from '@e2b/code-interpreter'

export async function POST(request: NextRequest) {
  try {
    const {
      access_token,
      repo_url,
      branch = 'main',
      project_name,
      user_id,
      template = 'base'
    } = await request.json()

    if (!access_token || !repo_url || !project_name || !user_id) {
      return NextResponse.json({
        error: "Access token, repository URL, project name, and user ID are required"
      }, { status: 400 })
    }

    console.log("[GitHub Clone] Starting repository clone:", { repo_url, branch, project_name })

    // Extract owner and repo name from URL
    const urlMatch = repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!urlMatch) {
      return NextResponse.json({
        error: "Invalid GitHub repository URL"
      }, { status: 400 })
    }

    const [, owner, repo] = urlMatch

    // Get repository details from GitHub API
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    )

    if (!repoResponse.ok) {
      const errorData = await repoResponse.json()
      return NextResponse.json({
        error: errorData.message || "Repository not found or access denied"
      }, { status: repoResponse.status })
    }

    const repoData = await repoResponse.json()
    console.log("[Create Sandbox] Creating sandbox...")
    // Create E2B sandbox with extended timeout for clone operations
    const sbx = await Sandbox.create();

    console.log("[Create Sandbox] Sandbox created:", sbx.sandboxId)

    // Set additional timeout for operations
    await sbx.setTimeout(180000) // 3 minutes for clone and dependency installation

    const sessionId = (sbx as any).sandboxId || (sbx as any).id
    console.log("[GitHub Clone] E2B sandbox created:", sessionId)

    // Choose correct clone URL (use token for private repos)
    const cloneUrl = repoData.private
      ? `https://x-access-token:${access_token}@github.com/${owner}/${repo}.git`
      : repoData.clone_url

    // Clone the repository with timeout handling
    console.log("[GitHub Clone] Starting clone operation...")
    const cloneResult = await sbx.runCode(`
import subprocess
import os
import json
import sys

# Set git config to avoid timeout issues
subprocess.run(['git', 'config', '--global', 'http.postBuffer', '524288000'], capture_output=True)
subprocess.run(['git', 'config', '--global', 'http.lowSpeedLimit', '0'], capture_output=True)
subprocess.run(['git', 'config', '--global', 'http.lowSpeedTime', '999999'], capture_output=True)
subprocess.run(['git', 'config', '--global', 'core.compression', '0'], capture_output=True)

print("Starting repository clone...")
sys.stdout.flush()

# Clone the repository with progress and timeout
try:
    result = subprocess.run([
        'git', 'clone',
        '--progress',
        '--depth', '1',  # Shallow clone for speed
        '--branch', '${branch}',
        ${JSON.stringify(cloneUrl)},
        'workspace'
    ], capture_output=True, text=True, cwd='/home/user', timeout=120)
except subprocess.TimeoutExpired:
    print("Clone operation timed out after 120 seconds")
    result = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="Clone timed out")

if result.returncode == 0:
    print("Repository cloned successfully")

    # List contents
    contents = subprocess.run(['ls', '-la', 'workspace'], capture_output=True, text=True, cwd='/home/user')
    print("Repository contents:")
    print(contents.stdout)

    # Check for package.json and install dependencies
    if os.path.exists('/home/user/workspace/package.json'):
        print("Found package.json, analyzing project...")
        sys.stdout.flush()

        import json
        package_manager = None
        install_cmd = None

        try:
            # Check for packageManager field in package.json
            with open('/home/user/workspace/package.json', 'r') as f:
                package_json = json.load(f)

                if 'packageManager' in package_json:
                    pm_spec = package_json['packageManager']
                    pm_name = pm_spec.split('@')[0]
                    print(f"Package manager specified in package.json: {pm_name}")

                    if pm_name == 'pnpm':
                        # Try to install pnpm if not present
                        try:
                            subprocess.run(['sh', '-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -'], capture_output=True, text=True, timeout=30)
                            os.environ['PATH'] = f"/home/user/.local/share/pnpm:{os.environ['PATH']}"
                            print("pnpm installed successfully")
                        except:
                            pass
                        package_manager = 'pnpm'
                        install_cmd = ['pnpm', 'install']
                    elif pm_name == 'yarn':
                        try:
                            subprocess.run(['npm', 'install', '-g', 'yarn'], capture_output=True, text=True, timeout=30)
                            print("yarn installed successfully")
                        except:
                            pass
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
                try:
                    subprocess.run(['sh', '-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -'], capture_output=True, text=True, timeout=30)
                    os.environ['PATH'] = f"/home/user/.local/share/pnpm:{os.environ['PATH']}"
                except:
                    pass
                package_manager = 'pnpm'
                install_cmd = ['pnpm', 'install']
            elif os.path.exists('/home/user/workspace/yarn.lock'):
                print("Detected yarn.lock")
                try:
                    subprocess.run(['npm', 'install', '-g', 'yarn'], capture_output=True, text=True, timeout=30)
                except:
                    pass
                package_manager = 'yarn'
                install_cmd = ['yarn', 'install']
            elif os.path.exists('/home/user/workspace/package-lock.json'):
                print("Detected package-lock.json")
                package_manager = 'npm'
                install_cmd = ['npm', 'ci', '--legacy-peer-deps']
            else:
                # Default to pnpm LTS as specified
                print("No lock file detected, defaulting to pnpm LTS")
                try:
                    subprocess.run(['sh', '-c', 'curl -fsSL https://get.pnpm.io/install.sh | sh -'], capture_output=True, text=True, timeout=30)
                    os.environ['PATH'] = f"/home/user/.local/share/pnpm:{os.environ['PATH']}"
                except:
                    pass
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

                install_result = subprocess.run(
                    install_cmd,
                    cwd='/home/user/workspace',
                    capture_output=True,
                    text=True,
                    timeout=120,
                    env=os.environ
                )

                if install_result.returncode == 0:
                    print(f"✅ Dependencies installed successfully with {package_manager}")
                    # List installed packages summary
                    if os.path.exists('/home/user/workspace/node_modules'):
                        count = len(os.listdir('/home/user/workspace/node_modules'))
                        print(f"📦 Installed {count} packages")
                else:
                    print(f"⚠️ Failed to install dependencies with {package_manager}:")
                    print(install_result.stderr[:1000])  # Limit error output
            except subprocess.TimeoutExpired:
                print("⏱️ Dependency installation timed out after 2 minutes")
            except Exception as e:
                print(f"❌ Error during installation: {e}")

    # Check for requirements.txt and install Python dependencies
    elif os.path.exists('/home/user/workspace/requirements.txt'):
        print("Found requirements.txt, installing Python dependencies...")
        sys.stdout.flush()
        try:
            install_result = subprocess.run(['pip', 'install', '-r', 'requirements.txt'], cwd='/home/user/workspace', capture_output=True, text=True, timeout=90)
        except subprocess.TimeoutExpired:
            print("Python dependency installation timed out")
            install_result = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="Install timed out")
        if install_result.returncode == 0:
            print("Python dependencies installed successfully")
        else:
            print("Failed to install Python dependencies:")
            print(install_result.stderr)

    # Get project structure
    def get_file_tree(path, prefix=""):
        tree = []
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                if os.path.isdir(item_path) and not item.startswith('.'):
                    tree.append(f"{prefix}{item}/")
                    tree.extend(get_file_tree(item_path, prefix + "  "))
                elif not item.startswith('.'):
                    tree.append(f"{prefix}{item}")
        except PermissionError:
            pass
        return tree

    project_tree = get_file_tree('/home/user/workspace')
    print("Project structure:")
    for item in project_tree[:20]:  # Limit to first 20 items
        print(item)

else:
    print("Failed to clone repository:")
    print(f"Return code: {result.returncode}")
    print(f"Error: {result.stderr}")
    print(f"Output: {result.stdout}")
    # Don't exit, let the sandbox continue
    `, { timeoutMs: 180000 })  // 3 minutes timeout for the entire operation

    console.log("[GitHub Clone] Clone result:", cloneResult.logs)

    // Check if clone failed but don't throw error immediately
    if (cloneResult.error) {
      console.error("[GitHub Clone] Clone operation had errors:", cloneResult.error)
    }

    // Get initial file listing
    const fileListing = await sbx.files.list("/home/user/workspace")
    console.log("[GitHub Clone] Initial file listing:", fileListing)

    // Create project record
    const projectId = `project_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const project = {
      id: projectId,
      name: project_name,
      description: repoData.description || '',
      framework: detectFramework(repoData.language),
      userId: user_id,
      githubRepo: repoData.clone_url,
      branch: branch,
      template: template,
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sandboxId: sessionId,
      repository: {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        private: repoData.private,
        html_url: repoData.html_url,
        language: repoData.language,
        stargazers_count: repoData.stargazers_count,
        forks_count: repoData.forks_count,
        updated_at: repoData.updated_at,
      },
    }

    // Persist project list in localStorage via response hint
    return NextResponse.json({
      success: true,
      project,
      sandbox: {
        sessionId,
        url: `https://${sessionId}.e2b.dev`,
        status: "running",
        files: fileListing,
      },
      cloneLogs: cloneResult.logs,
    })
  } catch (error) {
    console.error("[GitHub Clone] Failed to clone repository:", error)

    // Check if it's a timeout error and provide better message
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("TimeoutError") || errorMessage.includes("port is not open")

    return NextResponse.json({
      error: isTimeout
        ? "Repository clone timed out. This may happen with large repositories."
        : "Failed to clone repository",
      details: errorMessage,
      suggestion: isTimeout
        ? "Try again with a smaller repository or use a shallow clone (--depth 1). The sandbox has been created and you can retry the clone."
        : undefined,
      sandboxId: (error as any).sandboxId || undefined  // Include sandbox ID if available for retry
    }, { status: 500 })
  }
}

function detectFramework(language: string): string {
  const frameworkMap: { [key: string]: string } = {
    'TypeScript': 'nextjs',
    'JavaScript': 'react',
    'Python': 'fastapi',
    'Java': 'spring',
    'Go': 'gin',
    'Rust': 'actix',
    'PHP': 'laravel',
    'Ruby': 'rails',
    'C#': 'aspnet',
    'C++': 'cpp',
    'C': 'c',
  }

  return frameworkMap[language] || 'nextjs'
}
