import { ModelSpec } from "../config.ts";
import { Printer } from "../terminal.ts";

export interface AgentScheme {
  model: ModelSpec;
  description: string;
  prompt: string;
  child_agents?: string[];
  tools?: string[];
  context_files?: string[];
  filters?: string[];
}

export type ToolCall = (tool: string, args: string) => Promise<string>;

export type runCompletions = (
  is_top_level: boolean,
  agent_scheme: AgentScheme,
  first_input: string,
  input: (waitIfEmpty: boolean) => Promise<string | null>,
  tool_callback: ToolCall,
  printer: Printer,
) => Promise<string>;
