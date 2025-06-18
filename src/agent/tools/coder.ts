/// builtin tool: coder

import { OpenAI } from "@openai/openai";
import { config, ModelSpec } from "../../config.ts";
import { ToolDefinition } from "./index.ts";
import * as log from "@std/log";
import { client, get_output_text, print_delta } from "../../adapters/openai.ts";
import Printer from "../../output.ts";
import { crayon } from "crayon";

export type CoderEditFormat = "whole" | "diff";

export type CoderToolConfig = {
  model: ModelSpec;
  description: string;
  edit_format: CoderEditFormat;
  prompt: string;
};

export const coder_description = config.tools.builtin.coder.description;

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
    const file_contents = await Promise.all(target_files.map(async (file) => {
        if (await Deno.stat(file).catch(() => null) === null) {
          return { file: file as string, content: null };
        }
        return {
          file: file as string,
          content: await Deno.readTextFile(file),
        };
    }));
    const modelspec = config.tools.builtin.coder.model;
    const res = await client.responses.create({
      input: [
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
      ],
      instructions: config.tools.builtin.coder.prompt,
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

    const output_text = get_output_text(response);

    const edit_lines: Record<string, { add: number; remove: number }> = {};
    let success_count = 0;
    let failure_count = 0;

    // apply changes to target files based on edit blocks in output_text
    for (const { file, search, replace: replacement } of iterate_edit_blocks(output_text)) {
      log.info(`Applying edit to file: ${file}`);
      printer && await printer.write(`Applying edit to file: ${file}\n`, crayon.green.bold);
      try {
        if (!target_files.includes(file)) {
          printer && await printer.write(`File ${file} is not in target_files, skipping.\n`, crayon.red.bold);
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
            printer && await printer.write(`File ${file} does not exist, but search text is not empty, skipping.\n`, crayon.red.bold);
            failure_count++;
          }
          continue;
        } else {
          const content = await Deno.readTextFile(file);
          const index = content.indexOf(search);
          if (index === -1) {
            printer && await printer.write(`Search text not found in ${file}, skipping.\n`, crayon.red.bold);
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

    return `${success_count} changes applied successfully, ${failure_count} changes failed.\n\n` +
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

const coder: ToolDefinition = {
  schema: coder_parameters_schema,
  description: coder_description,
  call: coder_call,
};
export default coder;
