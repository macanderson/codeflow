import { createTwoFilesPatch } from "diff"


/**
 * Parse agent commands from message content.
 *
 * Supports commands like:
 * - @edit file.ts
 * - @create newfile.ts
 * - @delete oldfile.ts
 * - @apply <diff>
 * - @run command
 */
export interface AgentCommand {
    type: "edit" | "create" | "delete" | "apply" | "run"
    path?: string
    content?: string
    patch?: string
    command?: string
}


export function parseAgentCommands(message: string): AgentCommand[] {
    const commands: AgentCommand[] = []
    const lines = message.split("\n")

    let currentCommand: AgentCommand | null = null
    let codeBlockContent: string[] = []
    let inCodeBlock = false
    let codeBlockLanguage = ""

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Check for code block start/end
        if (line.startsWith("```")) {
            if (inCodeBlock) {
                // End of code block
                if (currentCommand) {
                    if (currentCommand.type === "edit" || currentCommand.type === "create") {
                        currentCommand.content = codeBlockContent.join("\n")
                    } else if (currentCommand.type === "apply") {
                        currentCommand.patch = codeBlockContent.join("\n")
                    }
                    commands.push(currentCommand)
                    currentCommand = null
                }
                inCodeBlock = false
                codeBlockContent = []
                codeBlockLanguage = ""
            } else {
                // Start of code block
                inCodeBlock = true
                codeBlockLanguage = line.slice(3).trim()
            }
            continue
        }

        if (inCodeBlock) {
            codeBlockContent.push(line)
            continue
        }

        // Check for agent commands
        if (line.startsWith("@edit ")) {
            const path = line.slice(6).trim()
            currentCommand = { type: "edit", path }
        } else if (line.startsWith("@create ")) {
            const path = line.slice(8).trim()
            currentCommand = { type: "create", path }
        } else if (line.startsWith("@delete ")) {
            const path = line.slice(8).trim()
            commands.push({ type: "delete", path })
        } else if (line.startsWith("@apply")) {
            currentCommand = { type: "apply" }
        } else if (line.startsWith("@run ")) {
            const command = line.slice(5).trim()
            commands.push({ type: "run", command })
        }
    }

    return commands
}


/**
 * Extract code blocks from a message.
 */
export interface CodeBlock {
    language: string
    filename?: string
    content: string
    startLine?: number
    endLine?: number
}


export function extractCodeBlocks(message: string): CodeBlock[] {
    const blocks: CodeBlock[] = []
    const codeBlockRegex = /```(\w+)?\s*([\w\/.]+)?\n([\s\S]*?)```/g

    let match
    while ((match = codeBlockRegex.exec(message)) !== null) {
        const language = match[1] || "plaintext"
        const filename = match[2]
        const content = match[3]

        blocks.push({
            language,
            filename,
            content
        })
    }

    return blocks
}


/**
 * Generate a unified diff from old and new content.
 */
export function generateDiff(
    filename: string,
    oldContent: string,
    newContent: string
): string {
    return createTwoFilesPatch(
        filename,
        filename,
        oldContent,
        newContent,
        "original",
        "modified"
    )
}


/**
 * Apply agent response to files in the sandbox.
 */
export interface FileEdit {
    path: string
    oldContent?: string
    newContent: string
    diff?: string
}


export async function applyAgentEdits(
    sandboxId: string,
    edits: FileEdit[]
): Promise<{ success: boolean; results: Array<{ path: string; status: string; error?: string }> }> {
    const results = []

    for (const edit of edits) {
        try {
            // Generate diff if not provided
            const diff = edit.diff || generateDiff(
                edit.path,
                edit.oldContent || "",
                edit.newContent
            )

            // Apply the diff using the sandbox execute endpoint
            const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patch: diff,
                    path: edit.path
                })
            })

            const result = await response.json()

            if (result.success) {
                results.push({
                    path: edit.path,
                    status: "success"
                })
            } else {
                results.push({
                    path: edit.path,
                    status: "failed",
                    error: result.error || "Unknown error"
                })
            }
        } catch (error) {
            results.push({
                path: edit.path,
                status: "failed",
                error: error instanceof Error ? error.message : String(error)
            })
        }
    }

    return {
        success: results.every(r => r.status === "success"),
        results
    }
}


/**
 * Parse and apply agent response with code changes.
 */
export async function processAgentResponse(
    sandboxId: string,
    message: string,
    fetchFileContent?: (path: string) => Promise<string>
): Promise<{ success: boolean; message: string; edits?: FileEdit[] }> {
    // Parse commands from the message
    const commands = parseAgentCommands(message)

    if (commands.length === 0) {
        // Try to extract code blocks for implicit edits
        const codeBlocks = extractCodeBlocks(message)

        if (codeBlocks.length === 0) {
            return {
                success: true,
                message: "No code changes detected"
            }
        }

        // Convert code blocks to edits
        const edits: FileEdit[] = []
        for (const block of codeBlocks) {
            if (block.filename) {
                let oldContent = ""
                if (fetchFileContent) {
                    try {
                        oldContent = await fetchFileContent(block.filename)
                    } catch {
                        // File doesn't exist, treat as create
                    }
                }

                edits.push({
                    path: block.filename,
                    oldContent,
                    newContent: block.content
                })
            }
        }

        if (edits.length > 0) {
            const result = await applyAgentEdits(sandboxId, edits)
            return {
                success: result.success,
                message: result.success
                    ? `Applied ${edits.length} file edit(s)`
                    : `Failed to apply some edits`,
                edits
            }
        }
    }

    // Process explicit commands
    const edits: FileEdit[] = []
    const runCommands: string[] = []

    for (const command of commands) {
        switch (command.type) {
            case "edit":
            case "create":
                if (command.path && command.content) {
                    let oldContent = ""
                    if (command.type === "edit" && fetchFileContent) {
                        try {
                            oldContent = await fetchFileContent(command.path)
                        } catch {
                            // File doesn't exist, treat as create
                        }
                    }

                    edits.push({
                        path: command.path,
                        oldContent,
                        newContent: command.content
                    })
                }
                break

            case "apply":
                if (command.patch) {
                    // Extract filename from patch
                    const filenameMatch = command.patch.match(/^\+\+\+ ([^\s]+)/m)
                    if (filenameMatch) {
                        edits.push({
                            path: filenameMatch[1],
                            diff: command.patch,
                            newContent: "" // Will be handled by diff application
                        })
                    }
                }
                break

            case "delete":
                if (command.path) {
                    // Delete by writing empty content
                    edits.push({
                        path: command.path,
                        newContent: ""
                    })
                }
                break

            case "run":
                if (command.command) {
                    runCommands.push(command.command)
                }
                break
        }
    }

    // Apply file edits
    let editResult = { success: true, results: [] as any[] }
    if (edits.length > 0) {
        editResult = await applyAgentEdits(sandboxId, edits)
    }

    // Execute run commands
    for (const cmd of runCommands) {
        try {
            await fetch(`/api/sandbox/${sandboxId}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: cmd })
            })
        } catch (error) {
            console.error("Failed to execute command:", cmd, error)
        }
    }

    return {
        success: editResult.success,
        message: `Processed ${commands.length} command(s): ${edits.length} file edit(s), ${runCommands.length} command(s)`,
        edits
    }
}
