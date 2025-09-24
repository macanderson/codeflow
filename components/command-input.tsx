"use client"

import React, { useState, useRef, useEffect, useCallback, forwardRef } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import {
  Code,
  FileEdit,
  FilePlus,
  Trash2,
  Play,
  Command,
} from "lucide-react"

interface Command {
  name: string
  icon: React.ReactNode
  description: string
  color: string
}

const commands: Command[] = [
  {
    name: "edit",
    icon: <FileEdit className="h-4 w-4" />,
    description: "Edit an existing file",
    color: "primary",
  },
  {
    name: "create",
    icon: <FilePlus className="h-4 w-4" />,
    description: "Create a new file",
    color: "primary",
  },
  {
    name: "delete",
    icon: <Trash2 className="h-4 w-4" />,
    description: "Delete a file",
    color: "primary",
  },
  {
    name: "run",
    icon: <Play className="h-4 w-4" />,
    description: "Execute code in the sandbox",
    color: "primary",
  },
]

interface CommandPill {
  command: string
  start: number
  end: number
}

interface CommandInputProps {
  value: string
  onChange: (value: string) => void
  onKeyPress?: (e: React.KeyboardEvent) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const CommandInput = forwardRef<HTMLTextAreaElement, CommandInputProps>(
  ({ value, onChange, onKeyPress, placeholder, disabled, className }, ref) => {
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [currentCommandStart, setCurrentCommandStart] = useState(-1)
    const [filteredCommands, setFilteredCommands] = useState<Command[]>([])
    const [cursorPosition, setCursorPosition] = useState(0)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

    // Combine refs
    useEffect(() => {
      if (ref && textareaRef.current) {
        if (typeof ref === "function") {
          ref(textareaRef.current)
        } else {
          ref.current = textareaRef.current
        }
      }
    }, [ref])

    // Parse commands from text
    const parseCommands = useCallback((text: string): CommandPill[] => {
      const pills: CommandPill[] = []
      const regex = /@(edit|create|delete|run)(?=\s|$)/g
      let match

      while ((match = regex.exec(text)) !== null) {
        pills.push({
          command: match[1],
          start: match.index,
          end: match.index + match[0].length,
        })
      }

      return pills
    }, [])

    // Update dropdown position
    const updateDropdownPosition = useCallback(() => {
      if (!textareaRef.current || currentCommandStart === -1) return

      const textarea = textareaRef.current
      const rect = textarea.getBoundingClientRect()

      // Calculate position relative to viewport
      const dropdownHeight = 280 // Reduced height for better fit
      const dropdownWidth = 256 // 16rem = 256px
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      // Default position: below the textarea
      let top = rect.bottom + 4
      let left = rect.left

      // Check if dropdown would go below viewport
      if (top + dropdownHeight > viewportHeight - 20) {
        // Try positioning above the textarea
        const spaceAbove = rect.top - 20
        const spaceBelow = viewportHeight - rect.bottom - 20

        if (spaceAbove > spaceBelow && spaceAbove >= dropdownHeight) {
          // More space above, position there
          top = rect.top - dropdownHeight - 4
        } else {
          // Keep below but adjust height if needed
          top = rect.bottom + 4
          // Ensure some minimum visibility
          if (top > viewportHeight - 100) {
            top = viewportHeight - dropdownHeight - 20
          }
        }
      }

      // Check if dropdown would go beyond right edge
      if (left + dropdownWidth > viewportWidth - 20) {
        left = viewportWidth - dropdownWidth - 20
      }

      // Ensure left doesn't go negative
      left = Math.max(20, left)

      // Ensure top doesn't go negative
      top = Math.max(20, top)

      setDropdownPosition({ top, left })
    }, [currentCommandStart])

    // Handle text changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      const newCursorPosition = e.target.selectionStart
      setCursorPosition(newCursorPosition)

      // Check if user is typing a command
      const textBeforeCursor = newValue.substring(0, newCursorPosition)
      const lastAtIndex = textBeforeCursor.lastIndexOf("@")

      if (lastAtIndex !== -1 && lastAtIndex === newCursorPosition - 1) {
        // User just typed @
        setCurrentCommandStart(lastAtIndex)
        setShowSuggestions(true)
        setFilteredCommands(commands)
        setSelectedIndex(0)
        updateDropdownPosition()
      } else if (lastAtIndex !== -1 && currentCommandStart === lastAtIndex) {
        // User is typing after @
        const commandText = newValue.substring(lastAtIndex + 1, newCursorPosition)
        const filtered = commands.filter(cmd =>
          cmd.name.toLowerCase().startsWith(commandText.toLowerCase())
        )

        if (filtered.length > 0 && !commandText.includes(" ")) {
          setFilteredCommands(filtered)
          setSelectedIndex(0)
          updateDropdownPosition()
        } else {
          setShowSuggestions(false)
          setCurrentCommandStart(-1)
        }
      } else {
        setShowSuggestions(false)
        setCurrentCommandStart(-1)
      }

      onChange(newValue)
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case "Tab":
        case "ArrowRight":
          if (showSuggestions && filteredCommands.length > 0) {
            e.preventDefault()
            insertCommand(filteredCommands[selectedIndex])
          }
          break
        case "Escape":
          setShowSuggestions(false)
          setCurrentCommandStart(-1)
          break
        case "Enter":
          if (showSuggestions && filteredCommands.length > 0 && !e.shiftKey) {
            e.preventDefault()
            insertCommand(filteredCommands[selectedIndex])
          }
          break
      }
    }

    // Insert selected command
    const insertCommand = (command: Command) => {
      if (currentCommandStart === -1) return

      const beforeCommand = value.substring(0, currentCommandStart)
      const afterCursor = value.substring(cursorPosition)
      const newValue = `${beforeCommand}@${command.name} ${afterCursor}`

      onChange(newValue)
      setShowSuggestions(false)
      setCurrentCommandStart(-1)

      // Update cursor position after React updates the textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = currentCommandStart + command.name.length + 2
          textareaRef.current.selectionStart = newCursorPos
          textareaRef.current.selectionEnd = newCursorPos
          textareaRef.current.focus()
        }
      }, 0)
    }

    // Render text with command pills
    const renderTextWithPills = () => {
      const pills = parseCommands(value)
      if (pills.length === 0) return <span className="whitespace-pre-wrap opacity-0">{value}</span>

      const segments: React.ReactNode[] = []
      let lastEnd = 0

      pills.forEach((pill, index) => {
        // Add text before pill
        if (pill.start > lastEnd) {
          segments.push(
            <span key={`text-${index}`} className="whitespace-pre-wrap opacity-0">
              {value.substring(lastEnd, pill.start)}
            </span>
          )
        }

        // Add pill
        const pillText = value.substring(pill.start, pill.end)
        segments.push(
          <span
            key={`pill-${index}`}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0 rounded-md",
              "bg-primary text-primary-foreground",
              "text-sm font-medium"
            )}
          >
            {pillText}
          </span>
        )

        lastEnd = pill.end
      })

      // Add remaining text
      if (lastEnd < value.length) {
        segments.push(
          <span key="text-end" className="whitespace-pre-wrap opacity-0">
            {value.substring(lastEnd)}
          </span>
        )
      }

      return segments
    }

    useEffect(() => {
      updateDropdownPosition()
    }, [updateDropdownPosition])

    return (
      <div className="relative w-full">
        {/* Overlay for rendering pills */}
        <div
          ref={overlayRef}
          className={cn(
            "absolute inset-0 pointer-events-none overflow-hidden",
            "whitespace-pre-wrap break-words",
            "p-3 text-sm",
            "rounded-md"
          )}
          style={{
            font: textareaRef.current
              ? window.getComputedStyle(textareaRef.current).font
              : undefined,
            lineHeight: textareaRef.current
              ? window.getComputedStyle(textareaRef.current).lineHeight
              : undefined,
            paddingRight: "3rem", // Account for the paperclip button
            resize: "none",
          }}
        >
          {renderTextWithPills()}
        </div>

        {/* Actual textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "relative z-10",
            "bg-transparent",
            "caret-foreground text-foreground",
            "p-3 text-sm",
            "w-full",
            className
          )}
        />

        {/* Command suggestions dropdown */}
        {showSuggestions && filteredCommands.length > 0 && (
          <Card
            ref={dropdownRef}
            className="fixed z-50 w-64 shadow-lg overflow-hidden"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              maxHeight: "280px",
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-b bg-background sticky top-0">
              <Command className="h-3 w-3" />
              <span>Commands</span>
            </div>
            <div className="overflow-y-auto max-h-[200px] p-1">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.name}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground outline-none",
                    "transition-colors",
                    index === selectedIndex && "bg-accent text-accent-foreground"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => insertCommand(command)}
                >
                  {command.icon}
                  <div className="flex-1 text-left">
                    <div className="font-medium">@{command.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {command.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground bg-background sticky bottom-0">
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Tab</kbd> or{" "}
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">→</kbd> to select
            </div>
          </Card>
        )}
      </div>
    )
  }
)

CommandInput.displayName = "CommandInput"

export { CommandInput }
