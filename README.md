# Codeflow

Codeflow is an autonomous coding agent that runs 100% natively in an E2B Sandbox. It can clone repositories, understand tasks, and autonomously write code, run commands, and make changes to accomplish user goals.

## 🚀 Features

- **Autonomous Task Execution**: Give Codeflow a task and watch it work autonomously
- **Secure Sandbox Environment**: All code execution happens in isolated E2B Sandbox  
- **Multi-LLM Support**: Works with multiple language model providers
- **Real-time Streaming**: See tool calls and outputs in real-time
- **Repository Management**: Clone, navigate, and modify any repository
- **Interactive Web Interface**: Modern Next.js frontend with terminal-like experience
- **Fast Apply**: Apply partial code edits efficiently (like Cursor)
- **MCP Integration**: Model Context Protocol support for enhanced capabilities

## 🛠 Technology Stack

- **Backend**: E2B JavaScript/Python SDK with TypeScript
- **Frontend**: Next.js with interactive web application
- **Sandbox**: E2B Sandbox for secure code execution
- **LLM**: Multiple provider support (OpenAI, Anthropic, etc.)

## 📋 Prerequisites

- Node.js 18+ 
- E2B account and API key
- LLM provider API keys (OpenAI, Anthropic, etc.)

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/macanderson/codeflow.git
cd codeflow
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
E2B_API_KEY=your_e2b_api_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 4. Run the development server
```bash
npm run dev
```

### 5. Open your browser
Navigate to `http://localhost:3000` and start using Codeflow!

## 🎯 How It Works

1. **Input**: Provide a task description and target repository
2. **Planning**: Codeflow analyzes the task and creates an execution plan
3. **Execution**: The agent clones the repo, runs commands, and makes changes in the E2B Sandbox
4. **Streaming**: Watch real-time logs of all actions and outputs
5. **Results**: Get the completed task with all changes properly committed

## 🏗 Project Structure

```
codeflow/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   ├── lib/
│   │   ├── e2b/            # E2B Sandbox integration
│   │   ├── llm/            # LLM provider abstractions  
│   │   └── agents/         # Core agent logic
│   └── types/              # TypeScript definitions
├── public/                 # Static assets
├── .env.example           # Environment variables template
└── README.md              # This file
```

## 🧪 Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@codeflow.dev
- 💬 Discord: [Join our community](https://discord.gg/codeflow)
- 🐛 Issues: [GitHub Issues](https://github.com/macanderson/codeflow/issues)

---

Built with ❤️ using E2B Sandbox
