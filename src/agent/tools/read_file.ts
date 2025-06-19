/// builtin tool: file read_file

import { config } from "../../config.ts";
import { ToolDefinition } from "./index.ts";

export const read_file_parameters_schema = {
  "type": "object",
  "properties": {
    "file_path": {
      "type": "string",
      "description":
        "Path to the file to read. Path should start with `./`",
    },
    "range": {
      "type": "string",
      "description":
        "Range to read from the file, in the format 'start-end', or 'full' to read the entire file.",
    },
    "line_numbers": {
      "type": "boolean",
      "description":
        "If true, the output will include line numbers.",
    },
  },
  "required": ["file_path", "range", "line_numbers"],
  additionalProperties: false,
};

export async function read_file_call(args: string): Promise<string> {
  try {
    const { file_path, range, line_numbers } = JSON.parse(args);
    if (typeof file_path !== "string" || !file_path.startsWith("./")) {
      return "Error: file_path must be a string starting with './'.";
    }
    let lines = (await Deno.readTextFile(file_path)).split("\n");
    if (line_numbers) {
      const digits = lines.length.toString().length;
      lines = lines.map((line, index) => `${String(index + 1).padStart(digits, " ")}: ${line}`);
    }

    if (range && range.includes("-")) {
      const [start, end] = range.split("-").map(Number);
      if (isNaN(start) || isNaN(end) || start <= 0 || end < start || end > lines.length) {
        return `Error: Invalid range specified. The file has ${lines.length} lines. Available range is 1-${lines.length}.`;
      }
      return lines.slice(start - 1, end).join("\n");
    }
    return lines.join("\n");
  } catch (error) {
    return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const read_file: () => ToolDefinition = () => ({
  schema: read_file_parameters_schema,
  description: config.tools.builtin.read_file.description,
  call: read_file_call,
});
export default read_file;
