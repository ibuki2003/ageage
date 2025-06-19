import { AgentScheme } from "./agent/types.ts";
import { parse } from "@std/yaml";
import { EditFileFilterConfig } from "./filters/edit_file.ts";

export type ModelSpec = {
  // adapter: string;
  model_id: string;

  max_output_tokens?: number;
  reasoning?: "low" | "medium" | "high";

  [key: string]: unknown;
};

export interface Config {
  default_agent: string;
  agents: Record<string, AgentScheme>;
  tools: {
    builtin: {
      read_file: { description: string; };
      find: { description: string; };
      grep: {
        description: string;
        line_limit: number;
      };
    };
  };
  filters: {
    edit_file: EditFileFilterConfig;
  };
  context_files: {
    prompt_header: string;
    files: string[];
  };
}

// empty default config; will be loaded from config.default.yaml on startup
export const config: Config = {
  default_agent: "",
  agents: { },
  tools: {
    builtin: {
      read_file: { description: "" },
      find: { description: "" },
      grep: { description: "", line_limit: 0 },
    },
  },
  filters: {
    edit_file: {
      instruction: "",
      edit_format: "diff",
    },
  },
  context_files: {
    prompt_header: "",
    files: [],
  },
};

// NOTE: in-place merge
function deepMerge<T>(target: T, source: Partial<T>): T {
  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = source[key] as any;
      continue;
    } else if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] as any, source[key] as any);
    } else {
      target[key] = source[key] as any;
    }
  }
  return target;
}

async function loadConfigFromFile(filePath: string) {
  if (!(await Deno.stat(filePath).catch(() => null))) {
    // console.warn(`Config file not found: ${filePath}`);
    return;
  }
  const fileContent = await Deno.readTextFile(filePath);
  const parsed = parse(fileContent) as Partial<Config>;
  deepMerge(config, parsed);
}

export async function loadConfig(files: string | string[] = []) {
  // at first, reset config to default
  const defaultConfigFile = new URL("../config.default.yaml", import.meta.url); // NOTE: here is ./src
  console.log("Loading default config from:", defaultConfigFile.toString());
  await loadConfigFromFile(defaultConfigFile.pathname);

  if (typeof files === "string") {
    await loadConfigFromFile(files);
  } else if (Array.isArray(files)) {
    for (const file of files) {
      await loadConfigFromFile(file);
    }
  } else {
    throw new Error("Invalid config files argument");
  }
}
