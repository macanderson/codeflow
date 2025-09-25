# Codeflow

Codeflow is an autonomous coding agent running on top of the E2B Sandbox that can be used to automate tasks on any repository.

## 🚀 Features

- **Autonomous Task Execution**: Give Codeflow a task and watch it work autonomously
- **Secure Sandbox Environment**: All code execution happens in isolated E2B Sandbox
- **Multi-LLM Support**: Works with multiple language model providers
- **Real-time Streaming**: See tool calls and outputs in real-time
- **Repository Management**: Clone, navigate, and modify any repository
- **Interactive Web Interface**: Modern Next.js frontend with terminal-like experience
- **Fast Apply**: Apply partial code edits efficiently (like Cursor)
- **MCP Integration**: Model Context Protocol support for enhanced capabilities
- **Smart suggestions** with categorized prompts for common coding tasks
- **Real-time chat** with typing indicators and message timestamps
- **File attachment support** for images and code files with preview
- **Code block rendering** with syntax highlighting and copy functionality
- **Message actions** including copy, thumbs up/down, and regenerate options
- **Responsive design** that adapts to different screen sizes

## 🛠 Technology Stack

- **Backend**: E2B JavaScript/Python SDK with TypeScript
- **Frontend**: Next.js with interactive web application
- **Sandbox**: E2B Sandbox for secure code execution
- **LLM**: Multiple provider support (OpenAI, Anthropic, etc.)

## 🏁 Getting Started

Follow these steps to set up and run Codeflow locally:

### 1. Clone the repository

```bash
git clone https://github.com/codeflow-ai/codeflow.git
cd codeflow
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory with the following variables:

```bash
# OpenAI API Key (required for LLM functionality)
OPENAI_API_KEY=your_openai_api_key_here

# E2B API Key (required for sandbox functionality)
E2B_API_KEY=your_e2b_api_key_here

# GitHub integration (required for repository import)
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/auth

# Optional: Cursor API integration
CURSOR_API_KEY=your_cursor_api_key

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Getting API Keys

**OpenAI API Key:**

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to the [API Keys section](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Give your key a name (e.g., "Codeflow Development")
6. Copy the generated key and add it to your `.env` file as `OPENAI_API_KEY`

**E2B API Key:**

1. Go to [e2b.dev](https://e2b.dev/)
2. Sign up or sign in to your account
3. Navigate to your [dashboard](https://e2b.dev/dashboard)
4. Go to the "API Keys" section
5. Click "Create API Key"
6. Give your key a name (e.g., "Codeflow Development")
7. Copy the generated key and add it to your `.env` file as `E2B_API_KEY`

### 4. Run the application

```bash
pnpm run dev
```
