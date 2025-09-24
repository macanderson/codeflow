import { createTwoFilesPatch } from "diff"


/**
 * Enhanced agent response handler for automatic diff generation and application.
 */


export interface CodeChange {
    type: "create" | "edit" | "delete"
    path: string
    content?: string
    originalContent?: string
    diff?: string
    language?: string
}


export interface AgentResponseMetadata {
    hasCodeChanges: boolean
    changes: CodeChange[]
    commands: string[]
    summary: string
}


/**
 * Parse code blocks from agent response and detect file changes.
 */
export function parseCodeChanges(response: string): CodeChange[] {
    const changes: CodeChange[] = []

    // Pattern to match code blocks with file paths
    const codeBlockPattern = /```(?:(\w+))?\s*(?:([^\n]+))?\n([\s\S]*?)```/g

    let match
    while ((match = codeBlockPattern.exec(response)) !== null) {
        const language = match[1] || "plaintext"
        const header = match[2] || ""
        const content = match[3]

        // Check if header contains a file path
        const filePathMatch = header.match(/(?:file:|path:)?\s*([^\s]+\.(tsx?|jsx?|py|css|html|json|md|txt))/i)

        if (filePathMatch) {
            const path = filePathMatch[1]

            // Determine if this is a creation or edit based on context
            const isCreation = response.toLowerCase().includes(`create ${path}`) ||
                               response.toLowerCase().includes(`creating ${path}`) ||
                               response.toLowerCase().includes(`new file ${path}`)

            changes.push({
                type: isCreation ? "create" : "edit",
                path,
                content,
                language
            })
        }
    }

    // Also look for explicit file operations in the text
    const explicitPatterns = [
        /(?:create|add|new)\s+(?:file\s+)?`?([^\s`]+\.(tsx?|jsx?|py|css|html|json|md|txt))`?/gi,
        /(?:edit|modify|update)\s+(?:file\s+)?`?([^\s`]+\.(tsx?|jsx?|py|css|html|json|md|txt))`?/gi,
        /(?:delete|remove)\s+(?:file\s+)?`?([^\s`]+\.(tsx?|jsx?|py|css|html|json|md|txt))`?/gi,
    ]

    for (const pattern of explicitPatterns) {
        let explicitMatch
        while ((explicitMatch = pattern.exec(response)) !== null) {
            const path = explicitMatch[1]
            const type = pattern.source.includes("create|add") ? "create" :
                        pattern.source.includes("delete|remove") ? "delete" : "edit"

            // Check if we already have this file in changes
            const existing = changes.find(c => c.path === path)
            if (!existing && type === "delete") {
                changes.push({ type: "delete", path })
            }
        }
    }

    return changes
}


/**
 * Generate diffs for all code changes.
 */
export async function generateDiffs(
    changes: CodeChange[],
    getFileContent: (path: string) => Promise<string>
): Promise<CodeChange[]> {
    const enhancedChanges: CodeChange[] = []

    for (const change of changes) {
        if (change.type === "delete") {
            enhancedChanges.push(change)
            continue
        }

        if (!change.content) {
            continue
        }

        try {
            const originalContent = change.type === "create" ? "" : await getFileContent(change.path)
            const diff = createTwoFilesPatch(
                change.path,
                change.path,
                originalContent,
                change.content,
                "original",
                "modified"
            )

            enhancedChanges.push({
                ...change,
                originalContent,
                diff
            })
        } catch (error) {
            // File doesn't exist, treat as create
            const diff = createTwoFilesPatch(
                change.path,
                change.path,
                "",
                change.content || "",
                "original",
                "modified"
            )

            enhancedChanges.push({
                ...change,
                type: "create",
                originalContent: "",
                diff
            })
        }
    }

    return enhancedChanges
}


/**
 * Apply code changes to the sandbox.
 */
export async function applyCodeChanges(
    sandboxId: string,
    changes: CodeChange[]
): Promise<{ success: boolean; applied: number; failed: number; errors: string[] }> {
    let applied = 0
    let failed = 0
    const errors: string[] = []

    for (const change of changes) {
        try {
            if (change.type === "delete") {
                // Delete file by removing it
                const response = await fetch(`/api/sandbox/${sandboxId}/files`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "delete",
                        path: change.path
                    })
                })

                if (response.ok) {
                    applied++
                } else {
                    failed++
                    errors.push(`Failed to delete ${change.path}`)
                }
            } else if (change.diff) {
                // Apply diff using patch
                const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patch: change.diff,
                        path: change.path
                    })
                })

                const result = await response.json()

                if (result.success) {
                    applied++
                } else {
                    failed++
                    errors.push(`Failed to apply diff to ${change.path}: ${result.error || "Unknown error"}`)
                }
            } else if (change.content) {
                // Direct file write
                const response = await fetch(`/api/sandbox/${sandboxId}/files`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "write",
                        path: change.path,
                        content: change.content
                    })
                })

                if (response.ok) {
                    applied++
                } else {
                    failed++
                    errors.push(`Failed to write ${change.path}`)
                }
            }
        } catch (error) {
            failed++
            errors.push(`Error processing ${change.path}: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    return {
        success: failed === 0,
        applied,
        failed,
        errors
    }
}


/**
 * Process agent response with automatic diff generation and application.
 */
export async function processAgentResponseWithDiffs(
    sandboxId: string,
    response: string
): Promise<AgentResponseMetadata & { applicationResult?: any }> {
    // Parse code changes from the response
    const changes = parseCodeChanges(response)

    // Extract shell commands
    const commands: string[] = []
    const commandPatterns = [
        /```(?:bash|sh|shell)\n([\s\S]*?)```/g,
        /\$\s+(.+)/g,
        />\s+(.+)/g
    ]

    for (const pattern of commandPatterns) {
        let cmdMatch
        while ((cmdMatch = pattern.exec(response)) !== null) {
            const cmd = cmdMatch[1].trim()
            if (cmd && !cmd.startsWith("#") && !cmd.startsWith("//")) {
                commands.push(cmd)
            }
        }
    }

    // Generate summary
    let summary = "Processed agent response"
    if (changes.length > 0) {
        summary = `Found ${changes.length} file change(s)`
    }
    if (commands.length > 0) {
        summary += ` and ${commands.length} command(s)`
    }

    // If there are code changes, generate diffs and apply them
    let applicationResult
    if (changes.length > 0 && sandboxId) {
        // Get file contents for generating diffs
        const getFileContent = async (path: string) => {
            const response = await fetch(`/api/sandbox/${sandboxId}/files`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "read", path })
            })
            const result = await response.json()
            return result.content || ""
        }

        // Generate diffs
        const changesWithDiffs = await generateDiffs(changes, getFileContent)

        // Apply changes
        applicationResult = await applyCodeChanges(sandboxId, changesWithDiffs)

        summary = applicationResult.success
            ? `Successfully applied ${applicationResult.applied} change(s)`
            : `Applied ${applicationResult.applied} change(s), ${applicationResult.failed} failed`
    }

    // Execute commands if any
    if (commands.length > 0 && sandboxId) {
        for (const cmd of commands) {
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
    }

    return {
        hasCodeChanges: changes.length > 0,
        changes,
        commands,
        summary,
        applicationResult
    }
}
