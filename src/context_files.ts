/// Context_files for the AI agent
/// file contents will be fed to the agent as context

import { config } from "./config.ts";

export async function context_files(...files: (string[] | undefined)[]): Promise<string> {
  let all_files = [...config.context_files.files];
  all_files.push(...(files.filter(e => e !== undefined)).flat());
  // make unique
  all_files = Array.from(new Set(all_files));

  const contents = await Promise.all(all_files.map(async (file) => {
    try {
      return await Deno.readTextFile(file);
    } catch (error) {
      return "";
    }
  }));

  return "\n\n" + config.context_files.prompt_header + "\n\n" + contents.join("\n\n");
}
