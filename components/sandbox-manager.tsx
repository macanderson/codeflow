"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Square, RotateCcw, Terminal, FileText, AlertCircle, CheckCircle, Clock } from "lucide-react"

interface SandboxManagerProps {
  projectId: string
  files: any[]
  onFileChange?: (path: string, content: string) => void
}

interface SandboxSession {
  id: string
  status: "starting" | "running" | "stopped" | "error"
  url?: string
  logs: string[]
  createdAt: Date
}

export function SandboxManager({ projectId, files, onFileChange }: SandboxManagerProps) {
  const [session, setSession] = useState<SandboxSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("console")
  const wsRef = useRef<WebSocket | null>(null)

  // Initialize sandbox session
  const startSandbox = async () => {
    setIsLoading(true)
    try {
      console.log("[v0] Starting e2b sandbox for project:", projectId)

      // Simulate e2b sandbox creation
      const response = await fetch("/api/sandbox/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          template: "node",
          files: files.map((f) => ({ path: f.path, content: f.content })),
        }),
      })

      const data = await response.json()

      const newSession: SandboxSession = {
        id: data.sessionId || `session_${Date.now()}`,
        status: "starting",
        url: data.url,
        logs: [],
        createdAt: new Date(),
      }

      setSession(newSession)

      // Connect to WebSocket for real-time updates
      connectWebSocket(newSession.id)

      // Simulate sandbox startup
      setTimeout(() => {
        setSession((prev) => (prev ? { ...prev, status: "running" } : null))
        addOutput("Sandbox started successfully")
        addOutput("Environment: Node.js 18.x")
        addOutput("Ready to execute commands")
      }, 2000)
    } catch (error) {
      console.error("[v0] Failed to start sandbox:", error)
      addOutput(`Error: Failed to start sandbox - ${error}`)
      setSession((prev) => (prev ? { ...prev, status: "error" } : null))
    } finally {
      setIsLoading(false)
    }
  }

  // Connect to WebSocket for real-time communication
  const connectWebSocket = (sessionId: string) => {
    try {
      // In a real implementation, this would connect to your e2b WebSocket
      const ws = new WebSocket(`ws://localhost:3001/sandbox/${sessionId}`)

      ws.onopen = () => {
        console.log("[v0] WebSocket connected to sandbox")
        addOutput("Connected to sandbox terminal")
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === "output") {
          addOutput(data.content)
        } else if (data.type === "file_change") {
          onFileChange?.(data.path, data.content)
        }
      }

      ws.onclose = () => {
        console.log("[v0] WebSocket disconnected")
        addOutput("Disconnected from sandbox")
      }

      wsRef.current = ws
    } catch (error) {
      console.error("[v0] WebSocket connection failed:", error)
    }
  }

  // Stop sandbox session
  const stopSandbox = async () => {
    if (!session) return

    setIsLoading(true)
    try {
      await fetch(`/api/sandbox/${session.id}/stop`, { method: "POST" })
      setSession((prev) => (prev ? { ...prev, status: "stopped" } : null))
      addOutput("Sandbox stopped")

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    } catch (error) {
      console.error("[v0] Failed to stop sandbox:", error)
      addOutput(`Error: Failed to stop sandbox - ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Execute command in sandbox
  const executeCommand = async (command: string) => {
    if (!session || session.status !== "running") return

    addOutput(`$ ${command}`)

    try {
      if (wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "command",
            command,
          }),
        )
      } else {
        // Fallback to HTTP API
        const response = await fetch(`/api/sandbox/${session.id}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        })

        const data = await response.json()
        addOutput(data.output || "Command executed")
      }
    } catch (error) {
      addOutput(`Error: ${error}`)
    }
  }

  // Add output to console
  const addOutput = (text: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`])
  }

  // Run project (npm start, etc.)
  const runProject = () => {
    executeCommand("npm install && npm start")
  }

  // Install dependencies
  const installDependencies = () => {
    executeCommand("npm install")
  }

  // Restart sandbox
  const restartSandbox = async () => {
    if (session) {
      await stopSandbox()
      setTimeout(startSandbox, 1000)
    }
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const getStatusIcon = () => {
    if (!session) return <Clock className="h-4 w-4" />

    switch (session.status) {
      case "starting":
        return <Clock className="h-4 w-4 animate-spin" />
      case "running":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "stopped":
        return <Square className="h-4 w-4 text-gray-500" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    if (!session) return "secondary"

    switch (session.status) {
      case "starting":
        return "secondary"
      case "running":
        return "default"
      case "stopped":
        return "secondary"
      case "error":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            e2b Sandbox
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusColor()} className="flex items-center gap-1">
              {getStatusIcon()}
              {session?.status || "Not started"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Control buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {!session || session.status === "stopped" ? (
            <Button onClick={startSandbox} disabled={isLoading} size="sm" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Start Sandbox
            </Button>
          ) : (
            <Button
              onClick={stopSandbox}
              disabled={isLoading}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Sandbox
            </Button>
          )}

          {session && session.status === "running" && (
            <>
              <Button
                onClick={runProject}
                size="sm"
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Play className="h-4 w-4" />
                Run Project
              </Button>

              <Button onClick={installDependencies} size="sm" variant="outline">
                Install Dependencies
              </Button>

              <Button
                onClick={restartSandbox}
                size="sm"
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </Button>
            </>
          )}
        </div>

        {/* Sandbox info */}
        {session && (
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Session ID: {session.id}</div>
            <div>Started: {session.createdAt.toLocaleString()}</div>
            {session.url && (
              <div>
                Preview URL:
                <a
                  href={session.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline ml-1"
                >
                  {session.url}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Output tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="console" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Console
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="console" className="mt-4">
            <ScrollArea className="h-64 w-full rounded border bg-black/5 p-4">
              <div className="font-mono text-sm space-y-1">
                {output.length === 0 ? (
                  <div className="text-muted-foreground">Console output will appear here...</div>
                ) : (
                  output.map((line, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <ScrollArea className="h-64 w-full rounded border bg-black/5 p-4">
              <div className="font-mono text-sm space-y-1">
                {session?.logs.length === 0 ? (
                  <div className="text-muted-foreground">Sandbox logs will appear here...</div>
                ) : (
                  session?.logs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
