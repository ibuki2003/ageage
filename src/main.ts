import { crayon } from "crayon";
import { runAgent } from "./agent/index.ts";
import { config, loadConfig } from "./config.ts";
import { setupLogger } from "./logger.ts";
import Printer from "./output.ts";
import { TextLineStream } from '@std/streams'


const CONFIG_HOME = (Deno.env.get("XDG_CONFIG_HOME") || "~/.config") + "/ageage";

async function main() {
  setupLogger();

  await loadConfig([
    CONFIG_HOME + "/config.yaml",
    "./config.yaml",
  ]);

  console.log(crayon.green("Hello, world!"));

  const stdin_reader = async function* () {
    const stream = Deno.stdin.readable.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream());

    for await (const line of stream) {
      yield line;
    }
  }();

  const printer = new Printer(0);

  const agent = config.agents[config.default_agent];

  await runAgent(agent, stdin_reader, printer);
}

// Handle SIGINT (Ctrl+C)
function sigIntHandler() {
  Deno.exit(0); // Exit gracefully
}
Deno.addSignalListener("SIGINT", sigIntHandler);

await main();
