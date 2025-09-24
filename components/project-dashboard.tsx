"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { NewProjectModal } from "@/components/new-project-modal"
import { Plus, GitBranch } from "lucide-react"

export function ProjectDashboard() {
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-balance">AI for developers building the future</h1>
        <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto">
          Empower your development workflow with autonomous coding agents that understand your codebase and build
          features at the speed of thought.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button size="lg" onClick={() => setShowNewProjectModal(true)} className="px-8 py-4 text-lg">
            <Plus className="h-6 w-6 mr-3" />
            New Project
          </Button>
        </div>
      </div>



      <NewProjectModal open={showNewProjectModal} onOpenChange={setShowNewProjectModal} />
    </div>
  )
}
