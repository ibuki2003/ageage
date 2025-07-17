/// builtin output parser: explicit_return

import { config } from "../config.ts";
import { Printer } from "../terminal.ts";
import { Filter } from "./index.ts";

export type ExplicitReturnFilterConfig = {
  trigger_word: string;
  instruction: string;
  repeating_input: string;
};

function return_filter_instructions(): string {
  return config.filters.explicit_return.instruction;
}

export async function return_filter_outlet(
  output_text: string,
  _printer: Printer,
): Promise<string[]> {
  if (output_text.includes(config.filters.explicit_return.trigger_word)) {
    return [];
  } else {
    return [config.filters.explicit_return.repeating_input];
  }
}

const return_file_filter: Filter = {
  instruction: return_filter_instructions,
  outlet: return_filter_outlet,
};

export default return_file_filter;
