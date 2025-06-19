/// builtin tool: grep

import { config } from "../../config.ts";
import { ToolDefinition } from "./index.ts";

export const grep_parameters_schema = {
  "type": "object",
  "properties": {
    "pattern": {
      "type": "string",
      "description":
        "Regular expression pattern",
    },
  },
  "required": ["pattern"],
  additionalProperties: false,
};

export async function grep_call(args: string): Promise<string> {
  const LINE_LIMIT = config.tools.builtin.grep.line_limit;
  const { pattern } = JSON.parse(args);
  const cmd = new Deno.Command("rg", {
    args: [
      "--line-number",
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
    return `Error executing grep command: ${error}`;
  }
  const output = new TextDecoder().decode(stdout);
  if (!output) {
    return "No files found matching the pattern.";
  }
  const lines = output.split("\n");
  if (lines.length <= LINE_LIMIT) {
    return output;
  } else {
    const limitedOutput = lines.slice(0, LINE_LIMIT).join("\n");
    return `${limitedOutput}\n... and ${lines.length - LINE_LIMIT} more lines`;
  }
}

const grep: () => ToolDefinition = () => ({
  schema: grep_parameters_schema,
  description: config.tools.builtin.grep.description,
  call: grep_call,
});
export default grep;
