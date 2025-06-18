import { crayon } from "crayon";
import { runAgent } from "./agent/index.ts";
import { config, loadConfig } from "./config.ts";
import { setupLogger } from "./logger.ts";
import Printer from "./output.ts";
import { TextLineStream } from '@std/streams'
import { load } from "@std/dotenv";
import { setApiKey } from "./adapters/openai.ts";

const HOME = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
if (!HOME) {
  throw new Error("HOME environment variable is not set. Please set it to your home directory.");
}
const CONFIG_HOME = (Deno.env.get("XDG_CONFIG_HOME") || `${HOME}/.config`) + "/ageage";
if (!Deno.env.get("XDG_CONFIG_HOME")) {
  console.warn(`Warning: XDG_CONFIG_HOME is not set. Using default: ${CONFIG_HOME}`);
}

{
  const stat = await Deno.stat(CONFIG_HOME).catch(() => null);
  if (!stat || !stat.isDirectory) {
    try {
      await Deno.mkdir(CONFIG_HOME, { recursive: true });
    } catch (error) {
      console.error(`Error creating config directory: ${error}`);
    }
  }
}

async function main() {
  setupLogger();

  for (const path of [ CONFIG_HOME + "/.env", "./.env" ]) {
    try {
      await load({ export: true, envPath: path });
    } catch (error) {
      console.warn(`Warning: Failed to load environment variables from ${path}: ${error}`);
    }
  }

  setApiKey();

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
