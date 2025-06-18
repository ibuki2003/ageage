import OpenAI from "@openai/openai";
import { AgentScheme, runCompletions } from "./types.ts";
import { crayon } from "crayon";
import { config } from "../config.ts";
import { availableTools } from "./tools/index.ts";
import * as log from "@std/log";
import { client, get_output_text, print_delta } from "../adapters/openai.ts";

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

export const adapter_openai: runCompletions = async (
  agent_scheme,
  input,
  tool_callback,
  printer,
) => {
  const modelspec = agent_scheme.model;

  let last_id: string = "";

  const first_input = typeof input === "string" ? input : (await input.next()).value;
  const input_iter = typeof input === "string" ? null : input;

  let reqinput: OpenAI.Responses.ResponseInput = [
    { role: "user", type: "message", content: first_input },
  ];

  const tools = getToolsScheme(agent_scheme);

  log.debug(`Using tools: ${tools.map((t) => t.name).join(", ")}`);

  while (true) {
    const res = await client.responses.create({
      previous_response_id: last_id || null,
      input: reqinput,
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
      await print_delta(chunk, printer);
      switch (chunk.type) {
        case "response.completed": {
          response = chunk.response;
          break;
        }
      }
    }

    // log.debug("Response received:", response?.output);

    if (!response) {
      throw new Error("No response received from OpenAI");
    }

    last_id = response.id;

    reqinput = [];

    // Process function calls from the response
    for (const output of response.output) {
      if (output.type === "function_call") {
        const result = await tool_callback(output.name, output.arguments);
        // log.debug(`Function call output for ${output.name}:`, result);
        reqinput.push({
          type: "function_call_output",
          call_id: output.call_id,
          output: result,
        });
      }
    }

    // Add user input if available
    const user_input = await (input_iter?.next());
    if (user_input && user_input.value) {
      const inp = user_input.value;
      log.debug("User input received:", inp);
      reqinput.push({
        type: "message",
        role: "user",
        content: inp,
      });
    }

    if (reqinput.length === 0) {
      // finally, print a separator line
      await printer.write("--------------------------------------------------\n", crayon.white.dim);

      // No more input, we can return the final output
      return get_output_text(response);
    }

    // Otherwise, we continue the loop
  }
};
