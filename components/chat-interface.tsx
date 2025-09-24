"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
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
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
  attachments?: Attachment[]
  codeBlocks?: CodeBlock[]
  isGenerating?: boolean
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
}

export function ChatInterface({ projectId, sandboxId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputValue
    if (!text.trim() && attachments.length === 0) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: text,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
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
        let assistantAccum = ''
        const pushAssistant = (content: string) => {
          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last && last.isGenerating) {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, content }
              return updated
            }
            return [...prev, { id: (Date.now()+2).toString(), type:'assistant', content, timestamp: new Date(), isGenerating: true }]
          })
        }
        pushAssistant('')
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
                assistantAccum += (assistantAccum ? '\n' : '') + (data.content || '')
                pushAssistant(assistantAccum)
              } else if (ev === 'tool') {
                assistantAccum += `\n\n> ${data.name}`
                pushAssistant(assistantAccum)
              } else if (ev === 'done') {
                assistantAccum = data.summary || assistantAccum
                pushAssistant(assistantAccum)
              } else if (ev === 'error') {
                assistantAccum += `\n\nError: ${data.error}`
                pushAssistant(assistantAccum)
              }
            } catch {}
          }
        }
        // finalize last assistant message
        setMessages(prev => prev.map(m => m.isGenerating ? { ...m, isGenerating: false } : m))
        responseContent = assistantAccum || 'Agent finished.'
      } else {
        responseContent = generateMockResponse(text)
        if (text.toLowerCase().includes("code") || text.toLowerCase().includes("component")) {
          codeBlocks = [mockCodeBlock]
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: responseContent,
        timestamp: new Date(),
        codeBlocks,
      }

      setMessages((prev) => [...prev, assistantMessage])
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
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          Online
        </Badge>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        {messages.length === 0 ? (
          <ChatSuggestions onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="p-4 space-y-6">
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
      </ScrollArea>

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
              placeholder="Ask me to build a feature, debug code, or help with your project..."
              className="min-h-[60px] max-h-32 resize-none pr-12"
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

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>Connected to e2b sandbox</span>
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
          <div
            className={cn(
              "rounded-lg p-3 text-sm",
              isUser
                ? "bg-primary text-primary-foreground ml-auto"
                : "bg-muted text-muted-foreground border border-border",
            )}
          >
            {message.content}
          </div>

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
