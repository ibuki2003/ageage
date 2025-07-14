import { ModelSpec } from "../config.ts";
import Printer from "../output.ts";

export interface AgentScheme {
  model: ModelSpec;
  description: string;
  require_explicit_exit?: boolean;
  prompt: string;
  child_agents?: string[];
  tools?: string[];
  context_files?: string[];
  filters?: string[];
}

export type ToolCall = (tool: string, args: string) => Promise<string>;

export type runCompletions = (
  agent_scheme: AgentScheme,
  input: string | AsyncGenerator<string>,
  tool_callback: ToolCall,
  printer: Printer,
) => Promise<string>;
