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

export const availableTools: Record<
  string,
  {
    schema: Record<string, unknown>;
    description: string;
    call: (args: string) => Promise<string>;
  }
> = {
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
};
