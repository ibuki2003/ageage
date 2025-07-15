import Printer from "../output.ts";
import edit_file from "./edit_file.ts";
import explicit_return from "./explicit_return.ts";

export type Filter = {
  instruction: () => string;
  outlet: (output_text: string, printer: Printer) => Promise<string[]>;
};

export const filters: Record<string, Filter> = {
  edit_file,
  explicit_return,
};

export function getFilterInstructions(enabled_filters: string[]): string {
  const instructions: string[] = [];
  for (const filter_name of enabled_filters) {
    const filter = filters[filter_name];
    if (filter) {
      instructions.push(filter.instruction());
    } else {
      console.warn(`Filter not found: ${filter_name}`);
    }
  }
  return instructions.join("\n\n");
}

export async function applyFiltersOutlet(
  output_text: string,
  enabled_filters: string[],
  printer: Printer,
): Promise<string[]> {
  const results: Promise<string[]>[] = [];
  for (const filter_name of enabled_filters) {
    const filter = filters[filter_name];
    if (filter) {
      results.push(filter.outlet(output_text, printer));
    } else {
      console.warn(`Filter not found: ${filter_name}`);
    }
  }
  const res = await Promise.all(results);
  return res.flat();
}
