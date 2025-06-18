import { OpenAI } from "@openai/openai";
import Printer from "../output.ts";
import { Crayon, crayon } from "crayon";

export const client = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") || "",
});

const OUTPUT_TEXT_COLOR = crayon.blue;
const REASONING_COLOR = crayon.yellow;

export async function print_delta(
  chunk: OpenAI.Responses.ResponseStreamEvent,
  printer: Printer,
  color_override?: { output?: Crayon; reasoning?: Crayon },
): Promise<void> {
  const output_color = color_override?.output || OUTPUT_TEXT_COLOR;
  const reasoning_color = color_override?.reasoning || REASONING_COLOR;

  switch (chunk.type) {
    // output text
    case "response.output_text.delta": {
      await printer.write(chunk.delta, output_color);
      break;
    }
    case "response.output_text.done": {
      await printer.write("\n");
      break;
    }

    // reasoning
    case "response.reasoning.delta":
    case "response.reasoning_summary.delta":
    case "response.reasoning_summary_text.delta": {
      const content = typeof chunk.delta === "string" ? chunk.delta : JSON.stringify(chunk.delta);
      await printer.write(content, reasoning_color);
      break;
    }
    case "response.reasoning.done":
    case "response.reasoning_summary.done":
    case "response.reasoning_summary_text.done": {
      await printer.write("\n");
      break;
    }
  }
}

export function get_output_text(response: OpenAI.Responses.Response): string {
  // note that response object in stream does not have output_text field
  return response.output.filter((o) => o.type === "message").flatMap((o) =>
    o.content.filter((c) => c.type == "output_text")
  ).map((c) => c.text).join("\n");
}

