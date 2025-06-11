import { ModelSpec } from "../config.ts";

export interface AgentScheme {
  model: ModelSpec;
  description: string;
  prompt: string;
  child_agents?: string[];
  tools?: string[];
}

export type ToolCall = (tool: string, args: string) => Promise<string>;

export type runCompletions = (
  agent_scheme: AgentScheme,
  prompt: string,
  tool_callback: ToolCall,
  output_writer: (message: string) => void,
  get_user_input: () => Promise<string | null>,
) => Promise<string>;
