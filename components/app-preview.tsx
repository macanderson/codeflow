"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, RefreshCw, Play, Square } from "lucide-react"

interface AppPreviewProps {
  sandboxId?: string
  projectName?: string
}

export function AppPreview({ sandboxId, projectName }: AppPreviewProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const startDevServer = async () => {
    if (!sandboxId) return

    setLoading(true)
    try {
      // Try to start the development server
      const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'npm start',
          language: 'bash'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setIsRunning(true)
        // In a real implementation, you'd get the actual preview URL from the sandbox
        setPreviewUrl(`https://${sandboxId}.e2b.dev:3000`)
      }
    } catch (error) {
      console.error('Failed to start dev server:', error)
    } finally {
      setLoading(false)
    }
  }

  const stopDevServer = async () => {
    if (!sandboxId) return

    setLoading(true)
    try {
      // Stop the development server
      const response = await fetch(`/api/sandbox/${sandboxId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'pkill -f "npm start" || pkill -f "node"',
          language: 'bash'
        })
      })

      setIsRunning(false)
      setPreviewUrl(null)
    } catch (error) {
      console.error('Failed to stop dev server:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">App Preview</CardTitle>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                Running
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                Stopped
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {projectName && (
          <div className="text-sm text-muted-foreground">
            Project: <span className="font-medium text-foreground">{projectName}</span>
          </div>
        )}

        <div className="space-y-3">
          {!isRunning ? (
            <Button 
              onClick={startDevServer} 
              disabled={loading || !sandboxId}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Development Server
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={stopDevServer} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop Server
                </>
              )}
            </Button>
          )}

          {previewUrl && (
            <Button 
              variant="outline" 
              className="w-full"
              asChild
            >
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
          )}
        </div>

        {isRunning && previewUrl ? (
          <div className="border rounded-lg overflow-hidden">
            <iframe
              src={previewUrl}
              className="w-full h-64"
              title="App Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          <div className="border rounded-lg h-64 flex items-center justify-center bg-muted/30">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded bg-muted mx-auto flex items-center justify-center">
                <ExternalLink className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {isRunning ? 'Loading preview...' : 'Start the development server to see your app'}
              </p>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• The preview runs in your E2B sandbox</p>
          <p>• Changes to your code will be reflected in real-time</p>
          <p>• Use the chat interface to modify your application</p>
        </div>
      </CardContent>
    </Card>
  )
}