# Copilot Instructions for Codeflow

## Project Overview

Codeflow is an autonomous coding agent built to accomplish user-provided tasks on specified repositories. It runs 100% natively in an E2B Sandbox, providing a secure and isolated environment for code execution and manipulation.

### Core Concept
Think of Codeflow as similar to Codex, Jules, or Devin - an AI agent that can autonomously:
- Clone repositories
- Plan and execute tasks
- Run commands and install packages
- Create and modify files
- Provide real-time feedback through streaming interfaces

## Architecture

### Technology Stack
- **Backend**: E2B JavaScript SDK (TypeScript) or E2B Python SDK
- **Frontend**: Next.js interactive web application
- **LLM Integration**: Multiple model/provider support
- **Sandbox**: E2B Sandbox for secure code execution

### Key Components
1. **Repository Management**: Clone and navigate target repositories
2. **Task Planning**: Break down user requests into actionable steps
3. **Code Execution**: Run commands safely in sandboxed environment
4. **File Operations**: Create, read, update, and delete files
5. **Package Management**: Install dependencies as needed
6. **Streaming Interface**: Real-time tool calls and output display

## Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow Next.js best practices for frontend development
- Implement proper error handling for sandbox operations
- Use async/await patterns for E2B SDK calls

### Key Features to Implement
- **Multi-LLM Support**: Abstract LLM providers for flexibility
- **Tool Streaming**: Real-time display of commands and outputs
- **Interactive UI**: Terminal-like interface showing agent actions
- **Fast Apply**: Partial code edit capabilities (similar to Cursor)
- **MCP Integration**: Model Context Protocol support

### E2B SDK Integration
When working with E2B Sandbox:
- Initialize sandbox with appropriate runtime environment
- Handle file system operations through sandbox API
- Stream command outputs to frontend
- Manage sandbox lifecycle (create, execute, cleanup)

### Frontend Development
- Use Next.js App Router for modern routing
- Implement real-time updates with WebSockets or Server-Sent Events
- Create intuitive UI for displaying agent logs and tool calls
- Design responsive interface for various screen sizes

### Security Considerations
- All code execution happens in isolated E2B Sandbox
- Validate user inputs before processing
- Implement proper authentication if needed
- Handle sensitive data appropriately

## File Structure Expectations

```
/
├── src/
│   ├── app/                 # Next.js app directory
│   ├── components/          # React components
│   ├── lib/                 # Utility libraries
│   │   ├── e2b/            # E2B SDK integration
│   │   ├── llm/            # LLM provider abstractions
│   │   └── agents/         # Agent logic
│   └── types/              # TypeScript type definitions
├── public/                 # Static assets
├── .env.example           # Environment variables template
├── package.json           # Dependencies and scripts
└── README.md             # Project documentation
```

## Environment Variables
Document expected environment variables:
- `E2B_API_KEY`: E2B Sandbox API key
- `OPENAI_API_KEY`: OpenAI API key (if using OpenAI)
- `ANTHROPIC_API_KEY`: Anthropic API key (if using Claude)
- Other LLM provider keys as needed

## Testing Strategy
- Unit tests for agent logic
- Integration tests for E2B Sandbox operations
- End-to-end tests for complete workflows
- Mock E2B operations for faster testing

## Performance Considerations
- Optimize sandbox startup time
- Implement efficient file watching for changes
- Use streaming for large outputs
- Handle concurrent operations properly

## Error Handling
- Graceful degradation when sandbox operations fail
- Clear error messages for users
- Proper logging for debugging
- Retry mechanisms for transient failures

## Development Workflow
1. Set up E2B account and obtain API key
2. Install dependencies with `npm install`
3. Configure environment variables
4. Run development server with `npm run dev`
5. Test sandbox operations thoroughly
6. Deploy with proper environment configuration

## Contributing
When contributing to this project:
- Follow existing code patterns
- Add tests for new functionality  
- Update documentation as needed
- Test in actual E2B Sandbox environment
- Consider performance implications of sandbox operations