import OpenAI from "@openai/openai";
import { AgentScheme, runCompletions, ToolCall } from "./types.ts";
import { crayon } from "crayon";
import { config } from "../config.ts";
import { availableTools } from "./tools/index.ts";
import * as log from "@std/log";

function getToolsScheme(scheme: AgentScheme): OpenAI.Responses.FunctionTool[] {
  const tools: OpenAI.Responses.FunctionTool[] = [];
  const agents = config.agents;

  if (scheme.child_agents) {
    for (const agent_name of scheme.child_agents) {
      const agent_scheme = agents[agent_name];
      if (!agent_scheme) {
        // throw new Error(`Agent scheme not found for ${agent_name}`);
        log.warn(`Agent scheme not found for ${agent_name}`);
        continue;
      }
      tools.push({
        type: "function",
        name: agent_name,
        // description: agent_scheme.description,
        description:
          `Call the agent "${agent_name}". ${agent_scheme.description}`,
        strict: true,
        parameters: {
          type: "object",
          properties: {
            request: {
              type: "string",
              description: "Request to the agent",
            },
          },
          required: ["request"],
          additionalProperties: false,
        },
      });
    }
  }

  if (scheme.tools) {
    for (const tool_name of scheme.tools) {
      const tool = availableTools[tool_name];
      if (!tool) {
        // throw new Error(`Tool not found: ${tool_name}`);
        log.warn(`Tool not found: ${tool_name}`);
        continue;
      }
      tools.push({
        type: "function",
        name: tool_name,
        description: tool.description,
        strict: true,
        parameters: tool.schema,
      });
    }
  }

  return tools;
}

const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
});

export const adapter_openai: runCompletions = async (
  agent_scheme,
  prompt,
  tool_callback,
  output_writer,
  get_user_input,
) => {
  const modelspec = agent_scheme.model;

  let last_id: string = "";

  let input: OpenAI.Responses.ResponseInput = [
    { role: "user", type: "message", content: prompt },
  ];

  const tools = getToolsScheme(agent_scheme);

  log.debug(`Using tools: ${tools.map((t) => t.name).join(", ")}`);

  while (true) {
    const res = await client.responses.create({
      previous_response_id: last_id || null,
      input,
      instructions: agent_scheme.prompt,
      stream: true,
      store: true,
      truncation: "auto",
      tools,
      parallel_tool_calls: false,

      model: modelspec.model_id as string || "",
      max_output_tokens: modelspec.max_output_tokens as number || null,
      reasoning: modelspec.reasoning
        ? { effort: modelspec.reasoning as OpenAI.ReasoningEffort }
        : null,
    });

    let response: OpenAI.Responses.Response | null = null;

    for await (const chunk of res) {
      switch (chunk.type) {
        // output text
        case "response.output_text.delta": {
          output_writer(crayon.blue(chunk.delta));
          break;
        }
        case "response.output_text.done": {
          output_writer("\n");
          break;
        }

        // reasoning
        case "response.reasoning.delta":
        case "response.reasoning_summary.delta":
        case "response.reasoning_summary_text.delta": {
          output_writer(crayon.yellow(chunk.delta));
          break;
        }
        case "response.reasoning.done":
        case "response.reasoning_summary.done":
        case "response.reasoning_summary_text.done": {
          output_writer("\n");
          break;
        }

        case "response.completed": {
          response = chunk.response;
          break;
        }
      }
    }

    log.debug("Response received:", response);

    if (!response) {
      throw new Error("No response received from OpenAI");
    }

    last_id = response.id;

    input = [];

    // Process function calls from the response
    for (const output of response.output) {
      if (output.type === "function_call") {
        const result = await tool_callback(output.name, output.arguments);
        // log.debug(`Function call output for ${output.name}:`, result);
        input.push({
          type: "function_call_output",
          call_id: output.call_id,
          output: result,
        });
      }
    }

    // Add user input if available
    const user_input = await get_user_input();
    if (user_input) {
      log.debug("User input received:", user_input);
      input.push({
        type: "message",
        role: "user",
        content: user_input,
      });
    }

    if (input.length === 0) {
      // No more input, we can return the final output
      return response.output.filter((o) => o.type === "message").flatMap((o) =>
        o.content.filter((c) => c.type == "output_text")
      ).map((c) => c.text).join("\n");
    }

    // Otherwise, we continue the loop
  }
};
