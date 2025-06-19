/// builtin output parser: edit_file

import { config } from "../config.ts";
import * as log from "@std/log";
import Printer from "../output.ts";
import { crayon } from "crayon";
import { Filter } from "./index.ts";

export type EditFileFilterFormat = "whole" | "diff";

export type EditFileFilterConfig = {
  edit_format: EditFileFilterFormat;
  instruction: string;
};

function edit_filter_instructions(): string {
  return config.filters.edit_file.instruction;
}

export async function edit_filter_outlet(output_text: string, printer: Printer): Promise<string[]> {
  try {
    const edit_lines: Record<string, { add: number; remove: number }> = {};
    let success_count = 0;
    let failure_count = 0;

    const errors: string[] = [];
    failure_count = 0;

    // apply changes to target files based on edit blocks in output_text
    let idx = 0;
    for (const { file, search, replace: replacement } of iterate_edit_blocks(output_text)) {
      ++idx;
      log.info(`Applying edit to file: ${file}`);
      printer && await printer.write(`Applying edit to file: ${file}\n`, crayon.green.bold);
      try {
        // TODO: check target file is valid
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
          let content = await Deno.readTextFile(file);
          if (!content.endsWith('\n')) {
            content += '\n'; // ensure file ends with newline
          }
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

    return errors.length > 0
      ? [`encountered the following errors while applying edits:\n${errors.join("\n")}`]
      : [];

  } catch (e) {
    return [`Error processing request: ${e}`];
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
          // NOTE: always add newline at the end
          yield { file, search: search.join("\n") + '\n', replace: replace.join("\n") + '\n' };
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

const edit_file_filter: Filter = {
  instruction: edit_filter_instructions,
  outlet: edit_filter_outlet,
};

export default edit_file_filter;
