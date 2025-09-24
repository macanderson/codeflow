import { ProjectWorkspace } from "@/components/project-workspace"

interface ProjectPageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return <ProjectWorkspace projectId={params.id} />
}
