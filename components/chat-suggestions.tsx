"use client"
import { Card } from "@/components/ui/card"
import { Code, Database, Palette, Bug, Zap, FileText } from "lucide-react"

interface ChatSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void
}

export function ChatSuggestions({ onSuggestionClick }: ChatSuggestionsProps) {
  const suggestions = [
    {
      icon: Code,
      title: "Explore the codebase",
      description: "Understand the project structure",
      prompt: "ls -la",
    },
    {
      icon: FileText,
      title: "View package.json",
      description: "Check project dependencies",
      prompt: "cat package.json",
    },
    {
      icon: Zap,
      title: "Install dependencies",
      description: "Set up the project",
      prompt: "npm install",
    },
    {
      icon: Code,
      title: "Start development server",
      description: "Run the application",
      prompt: "npm start",
    },
    {
      icon: Bug,
      title: "Check for issues",
      description: "Run linting and tests",
      prompt: "npm run lint",
    },
    {
      icon: Database,
      title: "Build the project",
      description: "Create production build",
      prompt: "npm run build",
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">What can I help you build today?</h3>
        <p className="text-sm text-muted-foreground">
          Choose a suggestion below or describe what you'd like to work on
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((suggestion, index) => (
          <Card
            key={index}
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-dashed"
            onClick={() => onSuggestionClick(suggestion.prompt)}
          >
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center">
                <suggestion.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-medium text-sm">{suggestion.title}</h4>
                <p className="text-xs text-muted-foreground">{suggestion.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
