/// builtin tool: git

import { ToolDefinition } from "./index.ts";
import { config } from "../../config.ts";

export const git_status_parameters_schema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

export async function git_status_call(_args: string): Promise<string> {
  const cmd = new Deno.Command("git", {
    args: ["status", "--porcelain"],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Error executing git status: ${error}`);
  }
  return output;
}

export function git_status(): ToolDefinition {
  return {
    schema: git_status_parameters_schema,
    description: config.tools.builtin.git.status.description,
    call: git_status_call,
  };
}

export const git_add_parameters_schema = {
  type: "object",
  properties: {
    files: {
      // type: "string",
      description: "File paths to add to the git staging area.",
      type: "array",
      items: {
        type: "string",
        // description: "A file path or glob pattern to add.",
      },
    },
  },
  required: ["files"],
  additionalProperties: false,
};

export async function git_add_call(args: string): Promise<string> {
  const { files } = JSON.parse(args);
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Invalid files: expected non-empty array of strings.");
  }
  const cmd = new Deno.Command("git", {
    args: ["add", "--", ...files],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Error executing git add: ${error}\n${output}\n`);
  }
  return output;
}

export function git_add(): ToolDefinition {
  return {
    schema: git_add_parameters_schema,
    description: config.tools.builtin.git.add.description,
    call: git_add_call,
  };
}

export const git_commit_parameters_schema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Commit message for git commit.",
    },
  },
  required: ["message"],
  additionalProperties: false,
};

export async function git_commit_call(args: string): Promise<string> {
  const { message } = JSON.parse(args);
  if (typeof message !== "string" || !message) {
    throw new Error("Invalid message: expected non-empty string.");
  }
  const cmd = new Deno.Command("git", {
    args: ["commit", "-m", message],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Error executing git commit: ${error}\n${output}\n`);
  }
  return output;
}

export function git_commit(): ToolDefinition {
  return {
    schema: git_commit_parameters_schema,
    description: config.tools.builtin.git.commit.description,
    call: git_commit_call,
  };
}

export const git_log_parameters_schema = {
  type: "object",
  properties: {
    maxCount: {
      type: "number",
      description: "Maximum number of log entries to show.",
    },
  },
  required: ["maxCount"],
  additionalProperties: false,
};

export async function git_log_call(args: string): Promise<string> {
  const { maxCount } = JSON.parse(args);
  const cmdArgs = ["log"];
  if (typeof maxCount === "number") {
    cmdArgs.push("-n", String(maxCount));
  }
  const cmd = new Deno.Command("git", {
    args: cmdArgs,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Error executing git log: ${error}\n${output}\n`);
  }
  return output;
}

export function git_log(): ToolDefinition {
  return {
    schema: git_log_parameters_schema,
    description: config.tools.builtin.git.log.description,
    call: git_log_call,
  };
}

export const git_diff_parameters_schema = {
  type: "object",
  properties: {
    args: {
      type: "array",
      description: "Arguments for git diff.",
      items: { type: "string" },
    },
  },
  required: ["args"],
  additionalProperties: false,
};

export async function git_diff_call(args: string): Promise<string> {
  const { args: diffArgs } = JSON.parse(args);
  if (!Array.isArray(diffArgs)) {
    throw new Error("Invalid args: expected array of strings.");
  }
  const cmd = new Deno.Command("git", {
    args: ["diff", ...diffArgs],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout, stderr, success } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Error executing git diff: ${error}\n${output}\n`);
  }
  return output;
}

export function git_diff(): ToolDefinition {
  return {
    schema: git_diff_parameters_schema,
    description: config.tools.builtin.git.git_diff.description,
    call: git_diff_call,
  };
}
