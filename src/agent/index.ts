import { crayon } from "crayon";
import { config } from "../config.ts";
import Printer from "../output.ts";
import { adapter_openai } from "./openai.ts";
import { availableTools } from "./tools/index.ts";
import { AgentScheme } from "./types.ts";
import * as log from "@std/log";

export async function runAgent(
  scheme: AgentScheme,
  input: string | AsyncGenerator<string>,
  printer: Printer,
): Promise<string> {
  if (typeof input === "string") {
    log.debug(`Running agent with input: ${input}`);
  } else {
    log.debug(`Running agent with input from stdin`);
  }

  return await adapter_openai(
    scheme,
    input,
    async (tool, args) => {
      const res = await routeToolCall(tool, args, await printer.get_deep())
      printer.write("\n");
      return res;
    },
    printer,
  );
}

/// call child agent or tool
const routeToolCall = async (
  tool: string,
  args: string,
  printer: Printer,
): Promise<string> => {
  log.debug(`Routing tool call: ${tool} with args: ${args}`);

  if (tool in availableTools) {
    // Call a tool
    log.debug(`Calling tool: ${tool}`);
    await printer.write(`Calling tool: ${tool} with args: `, crayon.cyan.bold);
    await printer.write(JSON.stringify(args, null, 2) + "\n", crayon.cyan);
    const toolCall = availableTools()[tool];
    try {
      const res = await toolCall.call(args, printer);
      await printer.write(`Tool ${tool} done.\n`);
      return res;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error(`Error calling tool ${tool}:`, error);
      await printer.write(`Error calling tool ${tool}: ${msg}`, crayon.red.bold);
      return JSON.stringify({ "error": msg });
    }
  }

  if (tool in config.agents) {
    // Call a child agent
    log.debug(`Calling agent: ${tool}`);
    const request = JSON.parse(args).request;

    await printer.write(`Agent: ${tool} with request:\n`, crayon.cyan.bold);
    await printer.write(request + "\n", crayon.cyan);

    const agentScheme = config.agents[tool];
    return await runAgent(
      agentScheme,
      request,
      printer,
    );
  }

  log.warn(`Trying to call unknown tool or agent: ${tool}`);
  return JSON.stringify({ "error": "Tool or agent not found" });
};
