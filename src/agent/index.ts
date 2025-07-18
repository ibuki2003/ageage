import { crayon } from "crayon";
import { config } from "../config.ts";
import { Printer } from "../terminal.ts";
import { adapter_openai } from "./openai.ts";
import { availableTools } from "./tools/index.ts";
import { AgentScheme } from "./types.ts";
import * as log from "@std/log";

export async function runAgent(
  is_top_level: boolean,
  scheme: AgentScheme,
  first_input: string,
  user_input: (waitIfEmpty: boolean) => Promise<string | null>,
  printer: Printer,
): Promise<string> {

  if (is_top_level && first_input === "") {
    const inp = await user_input(true);
    if (inp === null) {
      throw new Error("No input provided");
    }
    first_input = inp;
  }

  return await adapter_openai(
    is_top_level,
    scheme,
    first_input,
    user_input,
    async (tool, args) => {
      const res = await routeToolCall(tool, args, user_input, await printer.get_deep());
      await printer.write("\n");
      return res;
    },
    printer,
  );
}

/// call child agent or tool
const routeToolCall = async (
  tool: string,
  args: string,
  user_input: (waitIfEmpty: boolean) => Promise<string | null>,
  printer: Printer,
): Promise<string> => {
  log.debug(`Routing tool call: ${tool} with args: ${args}`);

  if (tool in availableTools()) {
    // Call a tool
    log.debug(`Calling tool: ${tool}`);
    await printer.write(`Calling tool: ${tool} `, crayon.cyan.bold);
    await printer.write("(" + args + ")\n", crayon.cyan);
    const toolCall = availableTools()[tool];
    try {
      const res = await toolCall.call(args, printer);
      await printer.write(`Tool ${tool} done.\n`);
      return res;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Error calling tool ${tool}:`, error);
      await printer.write(
        `Error calling tool ${tool}: ${msg}`,
        crayon.red.bold,
      );
      return JSON.stringify({ "error": msg });
    }
  }

  if (tool in config.agents) {
    // Call a child agent
    const request: string = JSON.parse(args).request;
    log.debug(`Calling agent: ${tool} with request: ${request}`);

    await printer.write(`Calling ${tool} with request:\n`, crayon.cyan.bold);
    await printer.write(request + "\n", crayon.cyan);

    const agentScheme = config.agents[tool];
    return await runAgent(
      false,
      agentScheme,
      request,
      user_input,
      printer,
    );
  }

  log.warn(`Trying to call unknown tool or agent: ${tool}`);
  return JSON.stringify({ "error": "Tool or agent not found" });
};
