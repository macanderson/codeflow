// Global type definitions for Codeflow

export interface Task {
  id: string;
  description: string;
  repositoryUrl: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  logs: TaskLog[];
}

export interface TaskLog {
  id: string;
  timestamp: Date;
  type: 'command' | 'output' | 'file_operation' | 'error' | 'info';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AgentConfig {
  llmProvider: LLMProvider;
  e2bApiKey: string;
  sandboxTemplate?: string;
  maxExecutionTime?: number;
}

export interface LLMProvider {
  name: 'openai' | 'anthropic' | 'google' | 'cohere';
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface SandboxSession {
  id: string;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'terminated';
  createdAt: Date;
  lastActivity: Date;
}

export interface FileOperation {
  type: 'create' | 'read' | 'update' | 'delete';
  path: string;
  content?: string;
  success: boolean;
  error?: string;
}

export interface CommandExecution {
  command: string;
  output: string;
  exitCode: number;
  duration: number;
  workingDirectory: string;
}