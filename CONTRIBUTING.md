# Contributing to Codeflow

Thank you for your interest in contributing to Codeflow! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- E2B account with API access
- LLM provider API keys (OpenAI, Anthropic, etc.)

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/codeflow.git
   cd codeflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

## Code Standards

### TypeScript
- Use strict TypeScript configuration
- Define proper types for all interfaces
- Avoid `any` types when possible
- Use meaningful variable and function names

### Code Style
- Follow ESLint configuration
- Use Prettier for consistent formatting
- Write descriptive commit messages
- Add JSDoc comments for public APIs

### Testing
- Write unit tests for new functionality
- Include integration tests for E2B operations
- Mock external services in tests
- Maintain test coverage above 80%

## Architecture Guidelines

### Agent Logic (`src/lib/agents/`)
- Keep agent logic modular and testable
- Implement proper error handling
- Use streaming for real-time feedback
- Follow single responsibility principle

### E2B Integration (`src/lib/e2b/`)
- Abstract sandbox operations
- Handle connection failures gracefully  
- Implement proper cleanup procedures
- Use TypeScript for type safety

### LLM Integration (`src/lib/llm/`)
- Support multiple providers
- Implement rate limiting
- Handle API errors appropriately
- Allow for model switching

### Frontend Components (`src/components/`)
- Build reusable components
- Use proper state management
- Implement responsive design
- Follow accessibility best practices

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow code standards
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm run test
   npm run lint
   npm run type-check
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add new agent capability"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Issue Guidelines

### Bug Reports
- Use the bug report template
- Include steps to reproduce
- Provide environment details
- Include relevant logs/screenshots

### Feature Requests
- Use the feature request template
- Explain the use case
- Provide implementation suggestions
- Consider backwards compatibility

## Security

- Never commit API keys or secrets
- Follow secure coding practices
- Report security issues privately
- Use environment variables for configuration

## Performance

- Profile sandbox operations
- Optimize for streaming performance
- Consider memory usage in long-running tasks
- Implement proper caching where appropriate

## Documentation

- Update README for user-facing changes
- Add JSDoc comments for APIs
- Update Copilot instructions when needed
- Keep examples current and working

## Community

- Be respectful and inclusive
- Help others in discussions
- Share knowledge and best practices
- Follow the code of conduct

## License

By contributing, you agree that your contributions will be licensed under the same MIT License as the project.