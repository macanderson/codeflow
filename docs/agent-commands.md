# Agent Commands and Code Diff Functionality

## Overview

The chat interface now supports advanced coding agent commands with automatic diff generation and file editing capabilities in the E2B sandbox environment.

## Features

### 1. Agent Commands
Users can provide direct commands in chat messages:

- **@edit file.ts** - Edit an existing file
- **@create newfile.ts** - Create a new file
- **@delete oldfile.ts** - Delete a file
- **@run command** - Execute a shell command
- **@apply** - Apply a diff patch

### 2. Automatic Diff Generation
When the agent responds with code blocks, the system automatically:
- Detects file paths in code block headers
- Generates diffs between current and new content
- Applies changes directly to the E2B sandbox

### 3. Enhanced Code Change Detection
The system can identify code changes from:
- Code blocks with file paths
- Explicit file operation mentions in text
- Agent responses containing code modifications

## Usage Examples

### Example 1: Direct Commands
```
User: @create components/Button.tsx
```tsx
export const Button = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>
}
```
```

### Example 2: Agent Response Processing
When the agent responds with code, it automatically:
1. Parses code blocks for file paths
2. Fetches current file content
3. Generates unified diffs
4. Applies patches to the sandbox
5. Shows status in the UI

### Example 3: Multiple File Operations
```
User: Please create a new React component with tests

Agent: I'll create a Button component with tests.

Creating `components/Button.tsx`:
```tsx
// Component code here
```

Creating `components/Button.test.tsx`:
```tsx
// Test code here
```
```

## Implementation Details

### Core Modules

1. **`lib/agent-commands.ts`**
   - Parses user commands (@edit, @create, etc.)
   - Extracts code blocks from messages
   - Generates diffs using the `diff` library
   - Applies edits via sandbox API

2. **`lib/agent-diff-handler.ts`**
   - Enhanced automatic diff generation
   - Intelligent code change detection
   - Batch processing of multiple file changes
   - Error handling and status reporting

3. **`components/chat-interface.tsx`**
   - Integrated command processing
   - Visual status indicators for file changes
   - Real-time diff application feedback
   - Error display for failed operations

### API Integration

The system uses the following E2B sandbox endpoints:

- `/api/sandbox/[sessionId]/execute` - Apply patches and run commands
- `/api/sandbox/[sessionId]/files` - Read, write, delete files

### Visual Feedback

The UI provides:
- Status badges (Applying, Success, Failed)
- File change indicators with operation types
- Error messages for failed operations
- Progress tracking for multiple file changes

## Benefits

1. **Seamless Code Application**: Agent responses automatically edit files
2. **Version Control Ready**: Generates proper git diffs
3. **Error Recovery**: Fallback mechanisms for failed operations
4. **Visual Transparency**: Users see exactly what changes are being made
5. **Command Flexibility**: Support for both explicit commands and implicit detection

## Future Enhancements

- Diff preview before application
- Undo/redo functionality
- Batch approval for multiple changes
- Integration with git commits
- Syntax highlighting for diffs
