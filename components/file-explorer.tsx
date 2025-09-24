"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  Folder,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Search,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FilePlus,
  Loader2,
  Star,
  StarOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import * as prismThemes from "react-syntax-highlighter/dist/esm/styles/prism"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSanitize from "rehype-sanitize"

const READ_ONLY = true

interface FileItem {
  id: string
  name: string
  path: string
  type: "file" | "folder"
  content?: string
  language?: string
  size?: number
  lastModified: Date
  children?: FileItem[]
  isOpen?: boolean
}

interface FileExplorerProps {
  projectId: string
  sandboxId?: string
}

export function FileExplorer({ projectId, sandboxId }: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createType, setCreateType] = useState<"file" | "folder">("file")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<{ path: string; name: string; type: "file" | "folder" }[]>([])

  // Fetch files from sandbox (root)
  useEffect(() => {
    const fetchFiles = async () => {
      if (!sandboxId) {
        setFiles(mockFileStructure)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/sandbox/${sandboxId}/files?path=/home/user/workspace`)
        const data = await response.json()

        if (data.success) {
          const normalized = normalizeE2BFileList(data.files, "/home/user/workspace")
          const fileTree = convertToFileTree(normalized)
          setFiles(fileTree)
        } else {
          setError(data.error || 'Failed to fetch files')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch files')
      } finally {
        setLoading(false)
      }
    }

    fetchFiles()
  }, [sandboxId])

  // Refresh listener: reload file tree when sandbox files change
  useEffect(() => {
    if (!sandboxId) return
    const handler = (e: Event) => {
      const ev = e as CustomEvent
      if (!ev.detail || ev.detail.sandboxId !== sandboxId) return
      ;(async () => {
        try {
          const response = await fetch(`/api/sandbox/${sandboxId}/files?path=/home/user/workspace`)
          const data = await response.json()
          if (data.success) {
            const normalized = normalizeE2BFileList(data.files, "/home/user/workspace")
            const fileTree = convertToFileTree(normalized)
            setFiles(fileTree)

            // If a file is selected, re-read its content
            if (selectedFile) {
              const sel = findFileById(fileTree, selectedFile)
              if (sel && sel.type === 'file') {
                try {
                  const resp = await fetch(`/api/sandbox/${sandboxId}/files`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'read', path: sel.path })
                  })
                  const resJson = await resp.json()
                  const content = resJson?.result?.content || ''
                  setFiles(prev => updateFileContent(prev, sel.id, content))
                } catch {}
              }
            }
          }
        } catch {}
      })()
    }
    window.addEventListener('sandbox-files-changed', handler as EventListener)
    return () => window.removeEventListener('sandbox-files-changed', handler as EventListener)
  }, [sandboxId, selectedFile])

  // Load bookmarks for this project
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`bookmarks:${projectId}`)
      if (raw) setBookmarks(JSON.parse(raw))
    } catch {}
  }, [projectId])

  useEffect(() => {
    try {
      localStorage.setItem(`bookmarks:${projectId}`, JSON.stringify(bookmarks))
    } catch {}
  }, [bookmarks, projectId])

  const isBookmarked = (path: string) => bookmarks.some((b) => b.path === path)

  const toggleBookmark = (file: FileItem) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.path === file.path)) {
        return prev.filter((b) => b.path !== file.path)
      }
      return [...prev, { path: file.path, name: file.name, type: file.type }]
    })
  }

  const openBookmark = (b: { path: string; name: string; type: "file" | "folder" }) => {
    setFiles((prev) => expandFoldersForPath(prev, b.path))
    const found = findFileByPath(files, b.path)
    if (found && found.type === 'file') {
      setSelectedFile(found.id)
    }
  }

  const handleFileSelect = async (fileId: string) => {
    setSelectedFile(fileId)

    // If it's a file, fetch its content
    if (sandboxId) {
      const file = findFileById(files, fileId)
      if (file && file.type === 'file') {
        try {
          const response = await fetch(`/api/sandbox/${sandboxId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'read',
              path: file.path
            })
          })
          const data = await response.json()

          if (data.success) {
            // Update the file content in the tree
            setFiles(prevFiles => updateFileContent(prevFiles, fileId, data.result.content))
          }
        } catch (err) {
          console.error('Failed to fetch file content:', err)
        }
      }
    }
  }

  const handleToggleFolder = async (folderId: string) => {
    // Toggle open state
    setFiles((prevFiles) => toggleFolderInTree(prevFiles, folderId))

    // Lazy load children when opening
    const folder = findFileById(files, folderId)
    if (sandboxId && folder && folder.type === 'folder' && (!folder.children || folder.children.length === 0)) {
      try {
        const listPath = folder.path.startsWith('/home/user/workspace') ? folder.path : `/home/user/workspace/${folder.path}`
        const response = await fetch(`/api/sandbox/${sandboxId}/files?path=${encodeURIComponent(listPath)}`)
        const data = await response.json()
        if (data.success) {
          const children = convertToFileTree(normalizeE2BFileList(data.files, listPath))
          setFiles((prev) => setFolderChildren(prev, folderId, children))
        }
      } catch (err) {
        console.error('Failed to list folder:', err)
      }
    }
  }

  const handleCreateItem = async (name: string, type: "file" | "folder", language?: string, content?: string) => {
    if (!sandboxId) {
      // Fallback to local state for demo
      const newItem: FileItem = {
        id: Date.now().toString(),
        name,
        path: name,
        type,
        content: content || "",
        language,
        lastModified: new Date(),
        children: type === "folder" ? [] : undefined,
      }
      setFiles((prevFiles) => [...prevFiles, newItem])
      setShowCreateDialog(false)
      return
    }

    try {
      const path = `/home/user/workspace/${name}`

      if (type === 'file') {
        await fetch(`/api/sandbox/${sandboxId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'write',
            path,
            content: content || ''
          })
        })
      } else {
        await fetch(`/api/sandbox/${sandboxId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_directory',
            path
          })
        })
      }

      // Refresh file tree
      const response = await fetch(`/api/sandbox/${sandboxId}/files?path=/home/user/workspace`)
      const data = await response.json()
      if (data.success) {
        setFiles(convertToFileTree(normalizeE2BFileList(data.files)))
      }

      setShowCreateDialog(false)
    } catch (err) {
      console.error('Failed to create item:', err)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    const file = findFileById(files, itemId)
    if (!file || !sandboxId) {
      setFiles((prevFiles) => deleteItemFromTree(prevFiles, itemId))
      if (selectedFile === itemId) {
        setSelectedFile(null)
      }
      return
    }

    try {
      await fetch(`/api/sandbox/${sandboxId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          path: file.path
        })
      })

      // Refresh file tree
      const response = await fetch(`/api/sandbox/${sandboxId}/files?path=/home/user/workspace`)
      const data = await response.json()
      if (data.success) {
        setFiles(convertToFileTree(normalizeE2BFileList(data.files)))
      }

      if (selectedFile === itemId) {
        setSelectedFile(null)
      }
    } catch (err) {
      console.error('Failed to delete item:', err)
    }
  }

  const handleRenameItem = async (itemId: string, newName: string) => {
    const file = findFileById(files, itemId)
    if (!file || !sandboxId) {
      setFiles((prevFiles) => renameItemInTree(prevFiles, itemId, newName))
      return
    }

    try {
      const dir = file.path.startsWith('/home/user/')
        ? file.path.split('/').slice(0, -1).join('/')
        : '/home/user/workspace'
      const newAbsPath = `${dir}/${newName}`
      await fetch(`/api/sandbox/${sandboxId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          path: file.path,
          newPath: newAbsPath
        })
      })

      // Refresh file tree
      const response = await fetch(`/api/sandbox/${sandboxId}/files?path=/home/user/workspace`)
      const data = await response.json()
      if (data.success) {
        setFiles(convertToFileTree(normalizeE2BFileList(data.files, "/home/user/workspace")))
      }
    } catch (err) {
      console.error('Failed to rename item:', err)
    }
  }

  const handleDuplicateItem = async (itemId: string) => {
    const file = findFileById(files, itemId)
    if (!file || !sandboxId) {
      setFiles((prevFiles) => duplicateItemInTree(prevFiles, itemId))
      return
    }

    try {
      const dir = file.path.startsWith('/home/user/')
        ? file.path.split('/').slice(0, -1).join('/')
        : '/home/user/workspace'
      const newPath = `${dir}/${file.name} copy`

      if (file.type === 'file') {
        // Read original file content
        const readResponse = await fetch(`/api/sandbox/${sandboxId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'read',
            path: file.path
          })
        })
        const readData = await readResponse.json()

        if (readData.success) {
          // Write to new file
          await fetch(`/api/sandbox/${sandboxId}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'write',
              path: newPath,
              content: readData.result.content
            })
          })
        }
      } else {
        // For folders, we'd need to recursively copy
        await fetch(`/api/sandbox/${sandboxId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_directory',
            path: newPath
          })
        })
      }

      // Refresh file tree
      const response = await fetch(`/api/sandbox/${sandboxId}/files?path=/home/user/workspace`)
      const data = await response.json()
      if (data.success) {
        setFiles(convertToFileTree(normalizeE2BFileList(data.files, "/home/user/workspace")))
      }
    } catch (err) {
      console.error('Failed to duplicate item:', err)
    }
  }

  const filteredFiles = searchQuery
    ? filterTreeByQuery(files, searchQuery)
    : files

  const selectedFileData = findFileById(files, selectedFile)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading files...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* File Tree Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Files</h3>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {bookmarks.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">Bookmarks</div>
              <div className="flex flex-wrap gap-2">
                {bookmarks.map((b) => (
                  <Button
                    key={b.path}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => openBookmark(b)}
                    title={b.path}
                  >
                    {b.type === 'folder' ? <Folder className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                    <span className="truncate max-w-[140px]">{b.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            <FileTree
              files={filteredFiles}
              onFileSelect={handleFileSelect}
              onToggleFolder={handleToggleFolder}
              onDeleteItem={handleDeleteItem}
              onRenameItem={handleRenameItem}
              onDuplicateItem={handleDuplicateItem}
              selectedFile={selectedFile}
              onToggleBookmark={toggleBookmark}
              isBookmarked={isBookmarked}
            />
          </div>
        </ScrollArea>
      </div>

      {/* File Content Area (read-only) */}
      <div className="flex-1">
        {selectedFileData ? (
          <FileEditor
            file={selectedFileData}
            sandboxId={sandboxId}
            onSave={async (content) => {
              // Read-only UI: no-op, agent handles writes
              console.log('Read-only preview. Save is disabled.')
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="h-12 w-12 mx-auto opacity-50" />
              <p>Select a file to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface FileTreeProps {
  files: FileItem[]
  onFileSelect: (fileId: string) => void
  onToggleFolder: (folderId: string) => void
  onDeleteItem: (itemId: string) => void
  onRenameItem: (itemId: string, newName: string) => void
  onDuplicateItem: (itemId: string) => void
  selectedFile: string | null
  level?: number
  onToggleBookmark: (file: FileItem) => void
  isBookmarked: (path: string) => boolean
}

function FileTree({
  files,
  onFileSelect,
  onToggleFolder,
  onDeleteItem,
  onRenameItem,
  onDuplicateItem,
  selectedFile,
  level = 0,
  onToggleBookmark,
  isBookmarked,
}: FileTreeProps) {
  return (
    <div className="space-y-1">
      {files.map((file) => (
        <FileTreeItem
          key={file.id}
          file={file}
          onFileSelect={onFileSelect}
          onToggleFolder={onToggleFolder}
          onDeleteItem={onDeleteItem}
          onRenameItem={onRenameItem}
          onDuplicateItem={onDuplicateItem}
          selectedFile={selectedFile}
          level={level}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={isBookmarked}
        />
      ))}
    </div>
  )
}

interface FileTreeItemProps {
  file: FileItem
  onFileSelect: (fileId: string) => void
  onToggleFolder: (folderId: string) => void
  onDeleteItem: (itemId: string) => void
  onRenameItem: (itemId: string, newName: string) => void
  onDuplicateItem: (itemId: string) => void
  selectedFile: string | null
  level: number
  onToggleBookmark: (file: FileItem) => void
  isBookmarked: (path: string) => boolean
}

function FileTreeItem({
  file,
  onFileSelect,
  onToggleFolder,
  onDeleteItem,
  onRenameItem,
  onDuplicateItem,
  selectedFile,
  level,
  onToggleBookmark,
  isBookmarked,
}: FileTreeItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(file.name)

  const handleClick = () => {
    if (file.type === "folder") {
      onToggleFolder(file.id)
    } else {
      onFileSelect(file.id)
    }
  }

  const handleRename = () => {
    if (newName.trim() && newName !== file.name) {
      onRenameItem(file.id, newName.trim())
    }
    setIsRenaming(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename()
    } else if (e.key === "Escape") {
      setNewName(file.name)
      setIsRenaming(false)
    }
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-muted/50 transition-colors",
          selectedFile === file.id && file.type === "file" && "bg-primary/10 text-primary",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0" onClick={handleClick}>
          {file.type === "folder" ? (
            <>
              {file.isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Folder className="h-4 w-4 flex-shrink-0" />
            </>
          ) : (
            <>
              <div className="w-3" />
              <FileText className="h-4 w-4 flex-shrink-0" />
            </>
          )}

          {isRenaming ? (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyPress={handleKeyPress}
              className="h-6 text-sm"
              autoFocus
            />
          ) : (
            <span className={cn("truncate cursor-pointer", file.type === "folder" && "font-medium")}>{file.name}</span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onToggleBookmark(file)}
          title={isBookmarked(file.path) ? "Remove bookmark" : "Add bookmark"}
        >
          {isBookmarked(file.path) ? <Star className="h-3 w-3 text-yellow-500" /> : <StarOff className="h-3 w-3" />}
        </Button>

        {!READ_ONLY && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicateItem(file.id)}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="h-4 w-4 mr-2" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDeleteItem(file.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      {file.type === "folder" && file.isOpen && file.children && (
        <FileTree
          files={file.children}
          onFileSelect={onFileSelect}
          onToggleFolder={onToggleFolder}
          onDeleteItem={onDeleteItem}
          onRenameItem={onRenameItem}
          onDuplicateItem={onDuplicateItem}
          selectedFile={selectedFile}
          level={level + 1}
          onToggleBookmark={onToggleBookmark}
          isBookmarked={isBookmarked}
        />
      )}
    </div>
  )
}

interface CreateItemDialogProps {
  type: "file" | "folder"
  onCreateItem: (name: string, type: "file" | "folder", language?: string, content?: string) => void
  onClose: () => void
}

function CreateItemDialog({ type, onCreateItem, onClose }: CreateItemDialogProps) {
  const [name, setName] = useState("")
  const [language, setLanguage] = useState("typescript")
  const [content, setContent] = useState("")

  const handleCreate = () => {
    if (name.trim()) {
      onCreateItem(name.trim(), type, type === "file" ? language : undefined, type === "file" ? content : undefined)
      setName("")
      setContent("")
    }
  }

  const getDefaultContent = (lang: string) => {
    switch (lang) {
      case "typescript":
      case "tsx":
        return `export default function ${name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "")}() {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  )
}`
      case "javascript":
      case "jsx":
        return `export default function ${name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "")}() {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  )
}`
      case "css":
        return `.container {
  display: flex;
  align-items: center;
  justify-content: center;
}`
      case "json":
        return `{
  "name": "example",
  "version": "1.0.0"
}`
      default:
        return ""
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New {type === "file" ? "File" : "Folder"}</DialogTitle>
        <DialogDescription>
          {type === "file" ? "Create a new file in your project" : "Create a new folder to organize your files"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "file" ? "component.tsx" : "components"}
            autoFocus
          />
        </div>

        {type === "file" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="tsx">TSX</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="jsx">JSX</SelectItem>
                  <SelectItem value="css">CSS</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Initial Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={getDefaultContent(language)}
                rows={8}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContent(getDefaultContent(language))}
                className="w-full"
              >
                Use Template
              </Button>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create {type === "file" ? "File" : "Folder"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

interface FileEditorProps {
  file: FileItem
  sandboxId?: string
  onSave: (content: string) => void
}

function FileEditor({ file, onSave }: FileEditorProps) {
  const [content, setContent] = useState(file.content || "")
  const [hasChanges, setHasChanges] = useState(false)

  // Keep editor content in sync with selected file
  useEffect(() => {
    setContent(file.content || "")
    setHasChanges(false)
  }, [file.id, file.content])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setHasChanges(newContent !== file.content)
  }

  const handleSave = () => {
    // Read-only: prevent saving
    console.log('Read-only preview. Save prevented.')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* File Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-medium">{file.name}</span>
          {hasChanges && <span className="text-xs text-muted-foreground">• Modified</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Last modified: {file.lastModified.toLocaleDateString()}</span>
          <Button size="sm" variant="outline" disabled>
            Read-only
          </Button>
        </div>
      </div>

      {/* Read-only Preview with syntax highlighting / markdown rendering */}
      <div className="flex-1 p-0 overflow-auto">
        {file.language === 'markdown' ? (
          <div className="prose prose-invert max-w-none px-4 py-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const content = String(children)
                  if (className && className.includes('language-')) {
                    return (
                      <SyntaxHighlighter
                        language={match?.[1] || 'text'}
                        style={(prismThemes as any).oneDark}
                        customStyle={{ margin: 0, borderRadius: 6, fontSize: '0.875rem' }}
                        wrapLongLines
                        {...props}
                      >
                        {content.replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    )
                  }
                  return (
                    <code className={className} {...props}>
                      {children as any}
                    </code>
                  )
                },
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {content || ''}
            </ReactMarkdown>
          </div>
        ) : (
          <SyntaxHighlighter
            language={file.language || 'text'}
            style={(prismThemes as any).oneDark}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: 'transparent',
              fontSize: '0.875rem',
              padding: '1rem',
            }}
            codeTagProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' } }}
            showLineNumbers
            wrapLongLines
          >
            {content ?? ''}
          </SyntaxHighlighter>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Lines: {content.split("\n").length}</span>
          <span>Characters: {content.length}</span>
          {file.language && <span>Language: {file.language}</span>}
        </div>
        <div>Ctrl+S to save</div>
      </div>
    </div>
  )
}

// Helper functions
function isBookmarked(path: string): boolean {
  return false
}
function toggleFolderInTree(files: FileItem[], folderId: string): FileItem[] {
  return files.map((file) => {
    if (file.id === folderId && file.type === "folder") {
      return { ...file, isOpen: !file.isOpen }
    }
    if (file.children) {
      return { ...file, children: toggleFolderInTree(file.children, folderId) }
    }
    return file
  })
}

function deleteItemFromTree(files: FileItem[], itemId: string): FileItem[] {
  return files
    .filter((file) => file.id !== itemId)
    .map((file) => ({
      ...file,
      children: file.children ? deleteItemFromTree(file.children, itemId) : undefined,
    }))
}

function renameItemInTree(files: FileItem[], itemId: string, newName: string): FileItem[] {
  return files.map((file) => {
    if (file.id === itemId) {
      return { ...file, name: newName, path: file.path.replace(file.name, newName) }
    }
    if (file.children) {
      return { ...file, children: renameItemInTree(file.children, itemId, newName) }
    }
    return file
  })
}

function duplicateItemInTree(files: FileItem[], itemId: string): FileItem[] {
  const itemToDuplicate = findFileById(files, itemId)
  if (!itemToDuplicate) return files

  const duplicatedItem: FileItem = {
    ...itemToDuplicate,
    id: Date.now().toString(),
    name: `${itemToDuplicate.name} copy`,
    path: `${itemToDuplicate.path} copy`,
  }

  return [...files, duplicatedItem]
}

function findFileById(files: FileItem[], fileId: string | null): FileItem | null {
  if (!fileId) return null

  for (const file of files) {
    if (file.id === fileId) {
      return file
    }
    if (file.children) {
      const found = findFileById(file.children, fileId)
      if (found) return found
    }
  }
  return null
}

function findFileByPath(files: FileItem[], path: string): FileItem | null {
  for (const file of files) {
    if (file.path === path) return file
    if (file.children) {
      const found = findFileByPath(file.children, path)
      if (found) return found
    }
  }
  return null
}

function expandFoldersForPath(files: FileItem[], path: string): FileItem[] {
  const segments = path.split('/').filter(Boolean)
  const recurse = (items: FileItem[], idx: number, accPath: string): FileItem[] => {
    return items.map((item) => {
      if (item.type === 'folder') {
        const itemPath = accPath ? `${accPath}/${item.name}` : item.name
        const shouldOpen = segments[idx] === item.name || path.startsWith(`${item.path}/`)
        const children = item.children ? recurse(item.children, idx + (segments[idx] === item.name ? 1 : 0), itemPath) : item.children
        return { ...item, isOpen: shouldOpen || item.isOpen, children }
      }
      return item
    })
  }
  return recurse(files, 0, '')
}

// Helper functions for E2B integration
function convertToFileTree(e2bFiles: any[]): FileItem[] {
  return e2bFiles.map((file, index) => ({
    id: `${file.path || file.name}_${index}`,
    name: file.name || file.path?.split('/').pop() || '',
    path: file.path || file.name,
    type: (file.type || file.kind) === 'directory' ? 'folder' : 'file',
    content: (file.type || file.kind) === 'file' ? '' : undefined,
    language: getLanguageFromExtension(file.name || file.path || ''),
    lastModified: new Date(),
    children: (file.type || file.kind) === 'directory' ? [] : undefined,
    isOpen: false,
  }))
}

// Normalize various possible E2B file listing shapes to a common shape
function normalizeE2BFileList(files: any[], basePath?: string): { name: string; path: string; type: 'file' | 'directory' }[] {
  if (!Array.isArray(files)) return []
  return files.map((f: any) => {
    const name = f.name || f.path?.split('/')?.pop() || ''
    const path = f.path || (basePath ? `${basePath}/${name}` : name)
    const t = f.type || f.kind || (f.isDir ? 'directory' : 'file')
    return { name, path, type: t }
  })
}

// Filter a file tree by search query while preserving folder hierarchy
function filterTreeByQuery(files: FileItem[], query: string): FileItem[] {
  const q = query.toLowerCase()
  const recurse = (items: FileItem[]): FileItem[] => {
    const result: FileItem[] = []
    for (const item of items) {
      if (item.type === 'folder') {
        const children = item.children ? recurse(item.children) : []
        if (children.length > 0 || item.name.toLowerCase().includes(q)) {
          result.push({ ...item, isOpen: true, children })
        }
      } else {
        if (item.name.toLowerCase().includes(q)) {
          result.push(item)
        }
      }
    }
    return result
  }
  return recurse(files)
}

function toggleBookmark(file: FileItem) {
  // placeholder, replaced in component scope
}

function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const languageMap: { [key: string]: string } = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'go': 'go',
    'rs': 'rust',
    'php': 'php',
    'rb': 'ruby',
    'swift': 'swift',
    'kt': 'kotlin',
  }
  return languageMap[ext || ''] || 'text'
}

function updateFileContent(files: FileItem[], fileId: string, content: string): FileItem[] {
  return files.map(file => {
    if (file.id === fileId) {
      return { ...file, content }
    }
    if (file.children) {
      return { ...file, children: updateFileContent(file.children, fileId, content) }
    }
    return file
  })
}

function setFolderChildren(files: FileItem[], folderId: string, children: FileItem[]): FileItem[] {
  return files.map(file => {
    if (file.id === folderId && file.type === 'folder') {
      return { ...file, children }
    }
    if (file.children) {
      return { ...file, children: setFolderChildren(file.children, folderId, children) }
    }
    return file
  })
}

// Mock data
const mockFileStructure: FileItem[] = [
  {
    id: "1",
    name: "src",
    path: "src",
    type: "folder",
    lastModified: new Date(),
    isOpen: true,
    children: [
      {
        id: "2",
        name: "components",
        path: "src/components",
        type: "folder",
        lastModified: new Date(),
        isOpen: true,
        children: [
          {
            id: "3",
            name: "Button.tsx",
            path: "src/components/Button.tsx",
            type: "file",
            language: "tsx",
            lastModified: new Date(),
            content: `import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={\`px-4 py-2 rounded \${variant === 'primary' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}\`}
    >
      {children}
    </button>
  )
}`,
          },
        ],
      },
      {
        id: "4",
        name: "pages",
        path: "src/pages",
        type: "folder",
        lastModified: new Date(),
        children: [
          {
            id: "5",
            name: "index.tsx",
            path: "src/pages/index.tsx",
            type: "file",
            language: "tsx",
            lastModified: new Date(),
            content: `import React from 'react'
import { Button } from '../components/Button'

export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Welcome</h1>
      <Button onClick={() => alert('Hello!')}>
        Click me
      </Button>
    </div>
  )
}`,
          },
        ],
      },
    ],
  },
  {
    id: "6",
    name: "package.json",
    path: "package.json",
    type: "file",
    language: "json",
    lastModified: new Date(),
    content: `{
  "name": "my-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "dependencies": {
    "react": "^18.0.0",
    "next": "^14.0.0"
  }
}`,
  },
]
