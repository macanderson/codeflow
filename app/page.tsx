import { Header } from "@/components/header"
import { ProjectDashboard } from "@/components/project-dashboard"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ProjectDashboard />
      </main>
    </div>
  )
}
