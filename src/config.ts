import { CoderToolConfig } from "./agent/tools/coder.ts";
import { AgentScheme } from "./agent/types.ts";

export type ModelSpec = {
  // adapter: string;
  model_id: string;

  max_output_tokens?: number;
  reasoning?: "low" | "medium" | "high";

  [key: string]: unknown;
};

export interface Config {
  agents: Record<string, AgentScheme>;
  tools: {
    builtin: {
      coder: CoderToolConfig;
      reader: { description: string; };
    };
  };
}

// default value; will be overridden on startup
export const config: Config = {
  agents: {
    "default": {
      model: { model_id: "gpt-4.1-nano" },
      description: "Default agent",
      prompt: "You are a helpful assistant.",
      // child_agents: ["calculator"],
      tools: ["calc"],
    },
  },
  tools: {
    builtin: {
      coder: {
        model: {
          model_id: "gpt-4.1-mini",
        },
        description: "Edit code files based on a request. Request will be sent as a prompt to a LLM. Edit summary will be returned as a string.",
        edit_format: "diff",
        prompt: "You are a code editor. Please apply the following changes.",
      },
      reader: {
        description: "Read the content of a file and return it as a string.",
      },
    },
  },
};

// TODO: load config from file
