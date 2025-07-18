/// builtin tool: git

import { ToolDefinition } from "./index.ts";
import { config } from "../../config.ts";
import { client, get_output_text } from "../../adapters/openai.ts";

/**
 * Run a git command with the given arguments and options.
 * @private
 * @param commandArgs - Array of git command arguments.
 * @param options - Deno.Command options (must include cwd).
 * @returns Decoded stdout string from the git command.
 * @throws Error if the git command exits with non-zero status.
 */
async function runGitCommand(
  commandArgs: string[],
  options: Deno.CommandOptions,
): Promise<string> {
  const cmd = new Deno.Command("git", {
    args: commandArgs,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    ...options,
  });
  const { stdout, stderr, success } = await cmd.output();
  const output = new TextDecoder().decode(stdout);
  const error = new TextDecoder().decode(stderr);
  if (!success) {
    const command = commandArgs[0];
    throw new Error(
      `Error executing git ${command}: ${error}${
        output ? `\n${output}\n` : ""
      }`,
    );
  }
  return output;
}

export const git_status_parameters_schema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

export async function git_status_call(_args: string): Promise<string> {
  /**
   * Execute 'git status --porcelain' using the runGitCommand helper.
   */
  const stdout = await runGitCommand(["status", "--porcelain"], {});
  return stdout;
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
  /**
   * Execute 'git add -- <files>' using the runGitCommand helper.
   * @param args - JSON string with { files: string[] }.
   * @returns Decoded stdout string.
   */
  const { files } = JSON.parse(args);
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Invalid files: expected non-empty array of strings.");
  }
  const stdout = await runGitCommand(["add", "--", ...files], {});
  return stdout;
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

/**
 * Appends a 'Co-authored-by: Ageage <ageage@fuwa.dev>' trailer to the commit message if not already present.
 * Detection is case-insensitive and the function is idempotent.
 * @param message - The original commit message.
 * @returns The commit message with the co-author trailer appended if absent.
 */
function ensureCoAuthorLine(message: string): string {
  const trailer = "Co-authored-by: Ageage <ageage@fuwa.dev>";
  const regex = new RegExp(trailer, "i");
  if (regex.test(message)) {
    return message;
  }
  return `${message}\n\n${trailer}`;
}

export async function git_commit_call(args: string): Promise<string> {
  /**
   * Execute 'git commit -m <message>' using the runGitCommand helper.
   * If message is empty, auto-generate using OpenAI.
   */
  const { message: origMessage } = JSON.parse(args);
  let message = origMessage;
  if (typeof message !== "string" || message.trim() === "") {
    try {
      const diff = await runGitCommand(["diff", "--cached"], {});
      const template = config.tools.builtin.git.commit.prompt_template;
      const prompt = template.replace('{diff}', diff);
      const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      const generated = get_output_text(completion)?.trim()
        || (completion.choices?.[0]?.message?.content ?? '').trim();
      message = generated.length
        ? generated
        : 'chore: update code';
      console.log(`Auto-generated commit message: ${message}`);
    } catch (e) {
      message = 'chore: update code';
      console.error(`Failed to auto-generate commit message, using fallback: ${message}`, e);
    }
  }
  const processedMessage = ensureCoAuthorLine(message);
  const stdout = await runGitCommand(["commit", "-m", processedMessage], {});
  return stdout;
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
  /**
   * Execute 'git log' with optional '-n <maxCount>' using the runGitCommand helper.
   * @param args - JSON string with { maxCount: number }.
   * @returns Decoded stdout string.
   */
  const { maxCount } = JSON.parse(args);
  const cmdArgs = ["log"];
  if (typeof maxCount === "number") {
    cmdArgs.push("-n", String(maxCount));
  }
  const stdout = await runGitCommand(cmdArgs, {});
  return stdout;
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
  /**
   * Execute 'git diff <args>' using the runGitCommand helper.
   * @param args - JSON string with { args: string[] }.
   * @returns Decoded stdout string.
   */
  const { args: diffArgs } = JSON.parse(args);
  if (!Array.isArray(diffArgs)) {
    throw new Error("Invalid args: expected array of strings.");
  }
  const stdout = await runGitCommand(["diff", ...diffArgs], {});
  return stdout;
}

export function git_diff(): ToolDefinition {
  return {
    schema: git_diff_parameters_schema,
    description: config.tools.builtin.git.git_diff.description,
    call: git_diff_call,
  };
}
