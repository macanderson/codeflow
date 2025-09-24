"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
// Removed ScrollArea in favor of a simple overflow container
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ChatSuggestions } from "@/components/chat-suggestions"
import {
  Send,
  Paperclip,
  Bot,
  User,
  Code,
  FileText,
  ImageIcon,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  FileEdit,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"
import {
  parseAgentCommands,
  extractCodeBlocks,
  processAgentResponse,
  type AgentCommand,
  type FileEdit as FileEditType,
} from "@/lib/agent-commands"
import {
  processAgentResponseWithDiffs,
  type CodeChange,
} from "@/lib/agent-diff-handler"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
  attachments?: Attachment[]
  codeBlocks?: CodeBlock[]
  isGenerating?: boolean
  reasoning?: string
  agentCommands?: AgentCommand[]
  fileEdits?: FileEditType[]
  codeChanges?: CodeChange[]
  editStatus?: "pending" | "applying" | "success" | "failed"
  editResult?: { applied: number; failed: number; errors?: string[] }
}

interface Attachment {
  id: string
  name: string
  type: "image" | "file"
  url: string
  size?: number
}

interface CodeBlock {
  id: string
  language: string
  filename?: string
  content: string
}

interface ChatInterfaceProps {
  projectId: string
  sandboxId?: string
  repoUrl?: string
  onSandboxRecreated?: (newSandboxId: string) => void
}

export function ChatInterface({ projectId, sandboxId, repoUrl, onSandboxRecreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recreating, setRecreating] = useState(false)

  const scrollToBottom = () => {
    const container = scrollAreaRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }

  useEffect(() => {
    const id = requestAnimationFrame(scrollToBottom)
    return () => cancelAnimationFrame(id)
  }, [messages, isGenerating])

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputValue
    if (!text.trim() && attachments.length === 0) return

    // Check if the message contains agent commands
    const commands = parseAgentCommands(text)

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: text,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      agentCommands: commands.length > 0 ? commands : undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setAttachments([])
    setIsGenerating(true)

    try {
      let responseContent = ""
      let codeBlocks: CodeBlock[] | undefined = undefined

      if (sandboxId) {
        // Stream events from the agent
        const resp = await fetch('/api/agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task: text, sandboxId })
        })
        if (!resp.ok || !resp.body) throw new Error('Failed to start agent')
        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let reasoningAccum = ''
        let summaryContent = ''
        const pushAssistant = (content: string, reasoning?: string) => {
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last && last.isGenerating) {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, content, reasoning }
              return updated
            }
            return [...prev, { id: (Date.now()+2).toString(), type:'assistant', content, reasoning, timestamp: new Date(), isGenerating: true }]
          })
        }
        pushAssistant('', '')
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() || ''
          for (const part of parts) {
            const lines = part.trim().split('\n')
            const ev = lines.find(l => l.startsWith('event: '))?.slice(7)
            const dataLine = lines.find(l => l.startsWith('data: '))?.slice(6)
            if (!ev || !dataLine) continue
            try {
              const data = JSON.parse(dataLine)
              if (ev === 'plan' || ev === 'log') {
                reasoningAccum += (reasoningAccum ? '\n' : '') + (data.content || '')
                pushAssistant(summaryContent, reasoningAccum)
              } else if (ev === 'tool') {
                reasoningAccum += `\n\n> ${data.name}`
                pushAssistant(summaryContent, reasoningAccum)
              } else if (ev === 'done') {
                summaryContent = data.summary || summaryContent
                pushAssistant(summaryContent, reasoningAccum)
              } else if (ev === 'error') {
                reasoningAccum += `\n\nError: ${data.error}`
                pushAssistant(summaryContent || 'An error occurred.', reasoningAccum)
              }
            } catch {}
          }
        }
        // finalize last assistant message
        setMessages(prev => prev.map(m => m.isGenerating ? { ...m, isGenerating: false } : m))
        responseContent = summaryContent || 'Agent finished.'

        // Process agent response for code edits with enhanced diff handling
        if (responseContent || reasoningAccum) {
          const fullContent = `${responseContent}\n\n${reasoningAccum}`

          // Try the enhanced diff handler first
          try {
            const diffResult = await processAgentResponseWithDiffs(sandboxId, fullContent)

            if (diffResult.hasCodeChanges) {
              setMessages(prev => prev.map(m => {
                if (m.id === (Date.now()+2).toString() || (m.isGenerating === false && m.type === 'assistant')) {
                  return {
                    ...m,
                    codeChanges: diffResult.changes,
                    editStatus: diffResult.applicationResult?.success ? 'success' : 'failed',
                    editResult: diffResult.applicationResult ? {
                      applied: diffResult.applicationResult.applied,
                      failed: diffResult.applicationResult.failed,
                      errors: diffResult.applicationResult.errors
                    } : undefined
                  }
                }
                return m
              }))
            }
          } catch (error) {
            console.error('Enhanced diff processing failed, falling back:', error)

            // Fallback to the original processor
            const processResult = await processAgentResponse(
              sandboxId,
              fullContent,
              async (path: string) => {
                const response = await fetch(`/api/sandbox/${sandboxId}/files`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'read', path })
                })
                const result = await response.json()
                return result.content || ''
              }
            )

            if (processResult.edits && processResult.edits.length > 0) {
              setMessages(prev => prev.map(m => {
                if (m.id === (Date.now()+2).toString() || (m.isGenerating === false && m.type === 'assistant')) {
                  return {
                    ...m,
                    fileEdits: processResult.edits,
                    editStatus: processResult.success ? 'success' : 'failed'
                  }
                }
                return m
              }))
            }
          }
        }
      } else {
        responseContent = generateMockResponse(text)
        if (text.toLowerCase().includes("code") || text.toLowerCase().includes("component")) {
          codeBlocks = [mockCodeBlock]
        }

        // Process user commands if sandbox exists
        if (sandboxId && commands.length > 0) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: "Processing your commands...",
            timestamp: new Date(),
            editStatus: "applying",
          }
          setMessages((prev) => [...prev, assistantMessage])

          const processResult = await processAgentResponse(
            sandboxId,
            text,
            async (path: string) => {
              const response = await fetch(`/api/sandbox/${sandboxId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'read', path })
              })
              const result = await response.json()
              return result.content || ''
            }
          )

          setMessages((prev) => prev.map(m => {
            if (m.id === assistantMessage.id) {
              return {
                ...m,
                content: processResult.message,
                fileEdits: processResult.edits,
                editStatus: processResult.success ? 'success' : 'failed'
              }
            }
            return m
          }))

          // Don't add another message below since we already added one
          setIsGenerating(false)
          return
        }
      }

      if (!sandboxId) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: responseContent,
          timestamp: new Date(),
          codeBlocks,
        }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Failed to execute command:', error)

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments: Attachment[] = files.map((file) => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      url: URL.createObjectURL(file),
      size: file.size,
    }))

    setAttachments((prev) => [...prev, ...newAttachments])
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const regenerateResponse = (messageId: string) => {
    // TODO: Implement response regeneration
    console.log("Regenerating response for message:", messageId)
  }

  const handleClearAndRecreate = async () => {
    if (!sandboxId && !repoUrl) {
      // Just clear chat if no sandbox/repo context
      setMessages([])
      return
    }

    try {
      setRecreating(true)
      // Show modal state and prevent input
      // 1) Stop existing sandbox if any
      if (sandboxId) {
        try {
          await fetch(`/api/sandbox/${sandboxId}/stop`, { method: 'POST' })
        } catch (e) {
          console.warn('Failed to stop existing sandbox (continuing):', e)
        }
      }

      // 2) Create new sandbox and re-clone repo if repoUrl provided
      let newSandboxId: string | undefined
      if (repoUrl) {
        const accessToken = localStorage.getItem('github_access_token')
        const branch = 'main'
        // Prefer repo name for project name if available in localStorage
        let projectName = projectId
        try {
          const current = localStorage.getItem('current_project')
          if (current) {
            const parsed = JSON.parse(current)
            projectName = parsed?.name || projectName
          }
        } catch {}
        const userId = 'anonymous'
        const resp = await fetch('/api/github/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: accessToken,
            repo_url: repoUrl,
            branch,
            project_name: projectName,
            user_id: userId,
          })
        })
        const data = await resp.json()
        if (!resp.ok || !data?.sandbox?.sessionId) {
          throw new Error(data?.error || 'Failed to create new sandbox')
        }
        newSandboxId = data.sandbox.sessionId

        // Persist new project/sandbox info
        if (data.project) localStorage.setItem('current_project', JSON.stringify(data.project))
        localStorage.setItem('current_sandbox', JSON.stringify(data.sandbox))
        try {
          const listRaw = localStorage.getItem('projects')
          const list = listRaw ? JSON.parse(listRaw) : []
          const existsIdx = list.findIndex((p: any) => p.id === data.project.id)
          if (existsIdx >= 0) list[existsIdx] = data.project
          else list.unshift(data.project)
          localStorage.setItem('projects', JSON.stringify(list))
        } catch {}
      }

      // 3) Clear chat history and notify parent
      setMessages([])
      if (newSandboxId && onSandboxRecreated) {
        onSandboxRecreated(newSandboxId)
      }
    } catch (e) {
      console.error('Failed to re-create sandbox:', e)
    } finally {
      setRecreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-medium">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">Autonomous coding agent</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleClearAndRecreate} disabled={recreating}>
            {recreating ? (
              <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Re-creating...</span>
            ) : (
              <span>Clear & Re-create</span>
            )}
          </Button>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Online
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollAreaRef}
        className="overflow-y-auto resize-y min-h-[240px] h-[60vh] max-h-[80vh]"
      >
        {messages.length === 0 ? (
          recreating ? (
            <div className="p-8 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Re-creating Sandbox Environment</h3>
                  <p className="text-sm text-muted-foreground">Cloning repository and setting up a fresh workspace...</p>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    <span>Creating E2B sandbox</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    <span>Cloning repository</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Installing dependencies</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-8">
              <ChatSuggestions onSuggestionClick={handleSuggestionClick} />
            </div>
          )
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-28 space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onCopy={copyToClipboard}
                onRegenerate={regenerateResponse}
              />
            ))}

            {isGenerating && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">AI Assistant</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() => removeAttachment(attachment.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to build a feature, or use @edit, @create, @delete, @run commands..."
              className="min-h-[60px] max-h-[40vh] resize-y pr-12"
              disabled={isGenerating}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => handleSendMessage()}
            disabled={isGenerating || (!inputValue.trim() && attachments.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
          accept="image/*,.txt,.md,.js,.ts,.jsx,.tsx,.py,.json,.css,.html"
        />

        <div className="flex flex-col gap-1 mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>Connected to e2b sandbox</span>
          </div>
          <div className="text-xs text-muted-foreground/70">
            Commands: @edit file.ts, @create new.ts, @delete old.ts, @run command
          </div>
        </div>
      </div>
    </div>
  )
}

interface ChatMessageProps {
  message: Message
  onCopy: (text: string) => void
  onRegenerate: (messageId: string) => void
}

function ChatMessage({ message, onCopy, onRegenerate }: ChatMessageProps) {
  const isUser = message.type === "user"
  const [showReasoning, setShowReasoning] = useState(false)

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center",
          isUser ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("flex-1 space-y-2", isUser && "flex flex-col items-end")}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{isUser ? "You" : "AI Assistant"}</span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Message Content */}
        <div className={cn("max-w-[80%]", isUser && "text-right")}>
          {(isUser || (!!message.content && !isUser)) && (
            <div
              className={cn(
                "rounded-lg p-3 text-sm prose prose-invert max-w-none",
                isUser
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-muted text-muted-foreground border border-border",
              )}
            >
              {isUser ? (
                message.content
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                    code: ({ className, children, ...props }: any) => (
                      <code className={cn(className)} {...props}>{children}</code>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => (
                <AttachmentDisplay key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}

          {/* Code Blocks */}
          {message.codeBlocks && message.codeBlocks.length > 0 && (
            <div className="mt-3 space-y-3">
              {message.codeBlocks.map((codeBlock) => (
                <CodeBlockDisplay key={codeBlock.id} codeBlock={codeBlock} onCopy={onCopy} />
              ))}
            </div>
          )}

          {/* Agent Commands */}
          {message.agentCommands && message.agentCommands.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted-foreground font-medium">Agent Commands:</div>
              <div className="space-y-1">
                {message.agentCommands.map((cmd, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                    <Code className="h-3 w-3" />
                    <span className="font-mono">
                      @{cmd.type} {cmd.path || cmd.command || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Edits Status */}
          {message.fileEdits && message.fileEdits.length > 0 && (
            <div className="mt-3">
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4" />
                    <span className="text-sm font-medium">File Changes</span>
                    {message.editStatus === "applying" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {message.editStatus === "success" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {message.editStatus === "failed" && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <Badge variant={message.editStatus === "success" ? "default" : message.editStatus === "failed" ? "destructive" : "secondary"}>
                    {message.editStatus === "applying" ? "Applying..." :
                     message.editStatus === "success" ? "Applied" :
                     message.editStatus === "failed" ? "Failed" : "Pending"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {message.fileEdits.map((edit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <code className="flex-1">{edit.path}</code>
                      {edit.diff && (
                        <Badge variant="outline" className="text-xs">
                          Diff
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Code Changes with Diffs */}
          {message.codeChanges && message.codeChanges.length > 0 && (
            <div className="mt-3">
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4" />
                    <span className="text-sm font-medium">Code Changes</span>
                    {message.editStatus === "applying" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {message.editStatus === "success" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {message.editStatus === "failed" && (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {message.editResult && (
                      <>
                        {message.editResult.applied > 0 && (
                          <Badge variant="default" className="text-xs">
                            {message.editResult.applied} applied
                          </Badge>
                        )}
                        {message.editResult.failed > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {message.editResult.failed} failed
                          </Badge>
                        )}
                      </>
                    )}
                    <Badge variant={message.editStatus === "success" ? "default" : message.editStatus === "failed" ? "destructive" : "secondary"}>
                      {message.editStatus === "applying" ? "Applying..." :
                       message.editStatus === "success" ? "Success" :
                       message.editStatus === "failed" ? "Failed" : "Pending"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  {message.codeChanges.map((change, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {change.type === "create" && (
                        <Badge variant="outline" className="text-green-600 border-green-600/50">
                          Create
                        </Badge>
                      )}
                      {change.type === "edit" && (
                        <Badge variant="outline" className="text-blue-600 border-blue-600/50">
                          Edit
                        </Badge>
                      )}
                      {change.type === "delete" && (
                        <Badge variant="outline" className="text-red-600 border-red-600/50">
                          Delete
                        </Badge>
                      )}
                      <code className="flex-1 text-muted-foreground">{change.path}</code>
                      {change.language && (
                        <Badge variant="secondary" className="text-xs">
                          {change.language}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                {message.editResult?.errors && message.editResult.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-600">
                    <div className="font-medium mb-1">Errors:</div>
                    {message.editResult.errors.map((error, idx) => (
                      <div key={idx}>• {error}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reasoning (collapsed by default) */}
          {!isUser && message.reasoning && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="px-2 py-1 h-7"
                onClick={() => setShowReasoning((v) => !v)}
              >
                Reasoning &gt;
              </Button>
              {showReasoning && (
                <div className="mt-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                  <pre className="whitespace-pre-wrap break-words">{message.reasoning}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Actions */}
        {!isUser && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onCopy(message.content)}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm">
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm">
              <ThumbsDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRegenerate(message.id)}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

interface AttachmentPreviewProps {
  attachment: Attachment
  onRemove: () => void
}

function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  return (
    <div className="flex items-center gap-2 bg-muted rounded-lg p-2 text-sm">
      {attachment.type === "image" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      <span className="truncate max-w-32">{attachment.name}</span>
      <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={onRemove}>
        ×
      </Button>
    </div>
  )
}

interface AttachmentDisplayProps {
  attachment: Attachment
}

function AttachmentDisplay({ attachment }: AttachmentDisplayProps) {
  if (attachment.type === "image") {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <img src={attachment.url || "/placeholder.svg"} alt={attachment.name} className="max-w-full h-auto" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-muted rounded-lg p-3 text-sm">
      <FileText className="h-4 w-4" />
      <span>{attachment.name}</span>
      {attachment.size && <span className="text-muted-foreground">({formatFileSize(attachment.size)})</span>}
    </div>
  )
}

interface CodeBlockDisplayProps {
  codeBlock: CodeBlock
  onCopy: (text: string) => void
}

function CodeBlockDisplay({ codeBlock, onCopy }: CodeBlockDisplayProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between bg-muted px-4 py-2 border-b">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <span className="text-sm font-medium">{codeBlock.filename || `${codeBlock.language} code`}</span>
          <Badge variant="secondary" className="text-xs">
            {codeBlock.language}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onCopy(codeBlock.content)}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-4">
        <pre className="text-sm overflow-x-auto">
          <code>{codeBlock.content}</code>
        </pre>
      </div>
    </Card>
  )
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

function generateMockResponse(input: string): string {
  const responses = [
    "I'll help you build that feature. Let me analyze your codebase and create the necessary components.",
    "Great idea! I can implement that functionality for you. Here's what I'll create:",
    "I understand what you need. Let me generate the code and integrate it with your existing project.",
    "Perfect! I'll build that component and make sure it follows your project's patterns and conventions.",
  ]

  return responses[Math.floor(Math.random() * responses.length)]
}

const mockCodeBlock: CodeBlock = {
  id: "1",
  language: "tsx",
  filename: "components/new-feature.tsx",
  content: `import React from 'react'
import { Button } from '@/components/ui/button'

export function NewFeature() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">New Feature</h2>
      <Button>Click me</Button>
    </div>
  )
}`,
}
