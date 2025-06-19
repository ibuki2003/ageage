import Printer from "../../output.ts";
import find from "./find.ts";
import grep from "./grep.ts";
import read_file from "./read_file.ts";
import { git_add, git_commit, git_log, git_status, git_diff } from "./git.ts";

export const calc_parameters_schema = {
  type: "object",
  properties: {
    expr: {
      type: "string",
      description:
        "A mathematical expression to evaluate. For example, '2 + 2 * 3'.",
    },
  },
  required: ["expr"],
  additionalProperties: false,
};

export type ToolDefinition = {
  schema: Record<string, unknown>;
  description: string;
  call: (args: string, printer?: Printer) => Promise<string>;
};

export const availableTools: () => Record<string, ToolDefinition> = () => ({
  "calc": {
    schema: calc_parameters_schema,
    description: "Evaluate a mathematical expression.",
    call: async (args: string) => {
      try {
        const expr = JSON.parse(args).expr;
        const result = eval(expr);
        return `Result: ${result}`;
      } catch (e) {
        return `Error evaluating expression: ${e}`;
      }
    },
  },
  read_file: read_file(),
  find: find(),
  grep: grep(),
  git_status: git_status(),
  git_add: git_add(),
  git_commit: git_commit(),
  git_log: git_log(),
  git_diff: git_diff(),
});
