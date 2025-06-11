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
      child_agents: ["calculator"],
      // tools: ["calc"],
    },
    "calculator": {
      model: { model_id: "gpt-4.1-nano" },
      description: "Evaluate mathematical expressions.",
      prompt: "Perform calculations based on the input.",
      // child_agents: [],
      // tools: ["calc"],
    },
  },
  tools: {
    builtin: {
      coder: {
        model: {
          model_id: "gpt-4.1-nano",
        },
        description: "Code editing tool",
        edit_format: "diff",
        prompt: "You are a code editor. Please apply the following changes.",
      },
    },
  },
};

// TODO: load config from file
