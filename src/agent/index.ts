import { config } from "../config.ts";
import { adapter_openai } from "./openai.ts";
import { availableTools } from "./tools/index.ts";
import { AgentScheme } from "./types.ts";

export async function runAgent(
  scheme: AgentScheme,
  input: string,
  output_writer: (message: string) => void,
  get_user_input: () => Promise<string | null>,
): Promise<string> {
  return await adapter_openai(
    scheme,
    input,
    (tool, args) => routeToolCall(tool, args, output_writer, get_user_input),
    output_writer,
    get_user_input,
  );
}

/// call child agent or tool
const routeToolCall = async (
  tool: string,
  args: string,
  output_writer: (message: string) => void,
  get_user_input: () => Promise<string | null>,
): Promise<string> => {
  if (tool in availableTools) {
    // Call a tool
    const toolCall = availableTools[tool];
    return await toolCall.call(args);
  }

  if (tool in config.agents) {
    // Call a child agent
    const agentScheme = config.agents[tool];
    return await runAgent(
      agentScheme,
      JSON.parse(args).request,
      output_writer,
      get_user_input,
    );
  }

  console.warn(`Trying to call unknown tool or agent: ${tool}`);
  return JSON.stringify({ "error": "Tool or agent not found" });
};
