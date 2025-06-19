/// builtin tool: find

import { config } from "../../config.ts";
import { ToolDefinition } from "./index.ts";

export const find_parameters_schema = {
  "type": "object",
  "properties": {
    "pattern": {
      "type": "string",
      "description":
        "Regular expression pattern to search for in the file names.",
    },
  },
  "required": ["pattern"],
  additionalProperties: false,
};

export async function find_call(args: string): Promise<string> {
  const { pattern } = JSON.parse(args);
  const cmd = new Deno.Command("fd", {
    args: [
      "--type",
      "f",
      "--color=never",
      "--hidden",
      "--exclude=.git",
      "--",
      pattern,
    ],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    return `Error executing find command: ${error}`;
  }
  const output = new TextDecoder().decode(stdout);
  if (!output) {
    return "No files found matching the pattern.";
  }
  return output;
}

const find: () => ToolDefinition = () => ({
  schema: find_parameters_schema,
  description: config.tools.builtin.find.description,
  call: find_call,
});
export default find;
