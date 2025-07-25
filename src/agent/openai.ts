import OpenAI from "@openai/openai";
import { AgentScheme, runCompletions } from "./types.ts";
import { crayon } from "crayon";
import { config } from "../config.ts";
import { availableTools } from "./tools/index.ts";
import * as log from "@std/log";
import { client, get_output_text, print_delta } from "../adapters/openai.ts";
import { context_files } from "../context_files.ts";
import { applyFiltersOutlet, getFilterInstructions } from "../filters/index.ts";

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
    const avl_tools = availableTools();
    for (const tool_name of scheme.tools) {
      const tool = avl_tools[tool_name];
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
  is_top_level,
  agent_scheme,
  first_input,
  user_input,
  tool_callback,
  printer,
) => {
  const enabled_filters = agent_scheme.filters ?? [];
  const filters_instructions = getFilterInstructions(enabled_filters);

  const modelspec = agent_scheme.model;

  let last_id: string = "";

  const tools = getToolsScheme(agent_scheme);

  log.debug(`Using tools: ${tools.map((t) => t.name).join(", ")}`);

  if (!first_input) {
    // throw new Error("No input provided to the agent");
    log.warn("No input provided to the agent");
    return "";
  }

  let reqinput: OpenAI.Responses.ResponseInput = [
    { role: "user", type: "message", content: first_input },
  ];

  while (true) {
    const res = await client.responses.create({
      previous_response_id: last_id || null,
      input: reqinput,
      // NOTE: load every time, because it can change
      instructions: agent_scheme.prompt + "\n" + filters_instructions +
        await context_files(agent_scheme.context_files),
      stream: true,
      store: true,
      truncation: "auto",
      tools,
      parallel_tool_calls: true,

      model: modelspec.model_id as string || "",
      max_output_tokens: modelspec.max_output_tokens as number || null,
      reasoning: modelspec.reasoning
        ? {
          effort: modelspec.reasoning as OpenAI.ReasoningEffort,
          summary: "auto",
        }
        : null,
    });
    await printer.write(`Request sent...\n`, crayon.white.dim);

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
        reqinput.push({
          type: "function_call_output",
          call_id: output.call_id,
          output: result ?? "",
        });
      }
    }

    const output_text = get_output_text(response);

    if (output_text) {
      const res = await applyFiltersOutlet(
        output_text,
        enabled_filters,
        printer,
      );
      reqinput.push(...res.map((text): OpenAI.Responses.ResponseInputItem => ({
        role: "user",
        content: text,
      })));
    }

    // Add user input if available
    // if other input is provided, we can skip waiting for user input
    const wait = is_top_level && reqinput.length === 0;
    do {
      if (wait) {
        await printer.write("Waiting for user input...\n", crayon.white.dim);
      }
      const inp = await user_input(wait); // skip if empty for non-top-level agents
      if (inp === null && wait) {
        await printer.write("Quitting...\n", crayon.white.dim);
        return get_output_text(response);
      }
      if (inp) {
        log.debug("User input received:", inp);
        reqinput.push({
          type: "message",
          role: "user",
          content: inp,
        });
      }
    } while (is_top_level && reqinput.length === 0);

    if (reqinput.length === 0) {
      // finally, print a separator line
      await printer.write(
        "--------------------------------------------------\n",
        crayon.white.dim,
      );

      // No more input, we can return the final output
      return output_text;
    }

    // Otherwise, we continue the loop
  }
};
