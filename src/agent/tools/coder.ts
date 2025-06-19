/// builtin tool: coder

import { OpenAI } from "@openai/openai";
import { config, ModelSpec } from "../../config.ts";
import { ToolDefinition } from "./index.ts";
import * as log from "@std/log";
import { client, get_output_text, print_delta } from "../../adapters/openai.ts";
import Printer from "../../output.ts";
import { crayon } from "crayon";
import { context_files } from "../../context_files.ts";

export type CoderEditFormat = "whole" | "diff";

export type CoderToolConfig = {
  model: ModelSpec;
  description: string;
  edit_format: CoderEditFormat;
  prompt: string;
  context_files?: string[];
};

export const coder_parameters_schema = {
  "type": "object",
  "properties": {
    "request": {
      "type": "string",
      "description":
        "Request to the coder tool, including the code to edit and the changes to apply.",
    },
    "target_files": {
      "type": "array",
      "items": {
        "type": "string",
      },
      "description":
        "The target file to apply the changes to. Path should start with `./`",
    },
  },
  "required": ["request", "target_files"],
  additionalProperties: false,
};

export async function coder_call(args: string, printer?: Printer): Promise<string> {
  try {
    const { target_files, request } = JSON.parse(args);
    if (!Array.isArray(target_files) || target_files.length === 0) {
      return "Error: target_files must be a non-empty array.";
    }
    if (target_files.some(file => !file.startsWith("./"))) {
      return "Error: target_files must start with './'.";
    }

    const file_contents = await Promise.all(target_files.map(async (file) => {
        if (await Deno.stat(file).catch(() => null) === null) {
          return { file: file as string, content: null };
        }
        return {
          file: file as string,
          content: await Deno.readTextFile(file),
        };
    }));
    let input: OpenAI.Responses.ResponseInput = [
      ...file_contents.filter(f => f.content !== null).map((file) => ({
        role: "user" as const,
        content: `Here is the content of the file ${file.file}:\n\n${file.content}`,
      })),
      // tell the model about the empty files which is in request
      {
        role: "user",
        content: file_contents
          .filter(f => f.content === null)
          .map(f => `- File ${f.file} is allowed to write and empty.`)
          .join("\n"),
      },
      { role: "user", content: request },
    ];
    let previous_response_id = "";
    const modelspec = config.tools.builtin.coder.model;

    let retry_count = 3;

    const edit_lines: Record<string, { add: number; remove: number }> = {};
    let success_count = 0;
    let failure_count = 0;

    while (retry_count > 0) {
      --retry_count;
      const res = await client.responses.create({
        input,
        previous_response_id: previous_response_id || undefined,
        // NOTE: load every time, because it can change
        instructions: config.tools.builtin.coder.prompt + await context_files(config.tools.builtin.coder.context_files),
        stream: true,
        store: true,
        parallel_tool_calls: false,

        model: modelspec.model_id as string || "",
        max_output_tokens: modelspec.max_output_tokens as number || null,
        reasoning: modelspec.reasoning
          ? { effort: modelspec.reasoning as OpenAI.ReasoningEffort }
          : null,
      });

      let response = null;

      for await (const chunk of res) {
        printer && await print_delta(chunk, printer, {
          output: crayon.white,
          reasoning: crayon.white.dim,
        });
        switch (chunk.type) {
          case "response.completed": {
            response = chunk.response;
            break;
          }
        }
      }

      if (!response) {
        throw new Error("No response received from OpenAI");
      }

      previous_response_id = response.id;

      const output_text = get_output_text(response);

      const errors: string[] = [];
      failure_count = 0;

      // apply changes to target files based on edit blocks in output_text
      let idx = 0;
      for (const { file, search, replace: replacement } of iterate_edit_blocks(output_text)) {
        ++idx;
        log.info(`Applying edit to file: ${file}`);
        printer && await printer.write(`Applying edit to file: ${file}\n`, crayon.green.bold);
        try {
          if (!target_files.includes(file)) {
            printer && await printer.write(`File ${file} is not in target_files.\n`, crayon.red.bold);
            errors.push(`Edit #${idx}: File ${file} is not in target_files.`);
            failure_count++;
            continue;
          }
          if (!(await Deno.stat(file).catch(() => null))) {
            if (search.trim() === "") {
              // create new file with replacement content
              await Deno.writeTextFile(file, replacement);
              success_count++;
              if (!edit_lines[file]) {
                edit_lines[file] = { add: 0, remove: 0 };
              }
              edit_lines[file].add += replacement.split(/\r?\n/).length;
            } else {
              printer && await printer.write(`File ${file} does not exist, but search text is not empty.\n`, crayon.red.bold);
              errors.push(`Edit #${idx}: File ${file} does not exist, but search text is not empty.`);
              failure_count++;
            }
            continue;
          } else {
            const content = await Deno.readTextFile(file);
            const index = content.indexOf(search);
            if (index === -1) {
              printer && await printer.write(`Search text not found in ${file}.\n`, crayon.red.bold);
              errors.push(`Edit #${idx}: Search text not found in ${file}.\n(search text: "${search.slice(0, 20)}...")`);
              failure_count++;
              continue;
            } else {
              success_count++;
            }
            const before = content.slice(0, index);
            const after = content.slice(index + search.length);
            await Deno.writeTextFile(file, before + replacement + after);

            if (!edit_lines[file]) {
              edit_lines[file] = { add: 0, remove: 0 };
            }
            edit_lines[file].add += replacement.split(/\r?\n/).length;
            edit_lines[file].remove += search.split(/\r?\n/).length;;
          }
        } catch (e) {
          printer && await printer.write(`Error applying edits to ${file}: ${e}\n`, crayon.red.bold);
        }
      }

      if (errors.length > 0) {
        input = [{
          role: "user",
          content: `encountered the following errors while applying edits:\n${errors.join("\n")}`,
        }];
      } else {
        break; // no errors, we can stop retrying
      }
    }
    return `${success_count} changes applied successfully, ${failure_count} changes failed.\n` +
      `Changes made:\n` +
      Object.entries(edit_lines).map(([file, changes]) => {
        return `- ${file}: ${changes.add} lines added, ${changes.remove} lines removed`;
      }).join("\n");
  } catch (e) {
    return `Error processing request: ${e}`;
  }
}

function* iterate_edit_blocks(output_text: string): Generator<{ file: string; search: string; replace: string }> {
  const lines = output_text.split("\n");
  let file: string = "";
  let search: string[] = [];
  let replace: string[] = [];
  let state = 0; // 0: initial, 1: in search, 2: in replace

  for (const line of lines) {
    const trimmed = line.trim();

    switch (state) {
      case 0: {
        if (trimmed === "<<<<<<< SEARCH") {
          state = 1;
        } else if (trimmed) {
          file = trimmed; // use last non-empty line as file name
        }
        break;
      }
      case 1: {
        if (trimmed === "=======") {
          state = 2;
        } else {
          search.push(line);
        }
        break;
      }
      case 2: {
        if (trimmed === ">>>>>>> REPLACE") {
          state = 0;
          yield { file, search: search.join("\n"), replace: replace.join("\n") };
          file = "";
          search = [];
          replace = [];
        } else {
          replace.push(line);
        }
        break;
      }
    }
  }
}

const coder: () => ToolDefinition = () => ({
  schema: coder_parameters_schema,
  description: config.tools.builtin.coder.description,
  call: coder_call,
});
export default coder;
