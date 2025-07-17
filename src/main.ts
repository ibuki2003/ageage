import { runAgent } from "./agent/index.ts";
import { config, loadConfig } from "./config.ts";
import { setupLogger } from "./logger.ts";
import { is_tty, Printer, readline } from "./terminal.ts";
import { load } from "@std/dotenv";
import { setApiKey } from "./adapters/openai.ts";
import { parseArgs } from "@std/cli/parse-args";

const VERSION = "0.0.1";

const HOME = Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
if (!HOME) {
  throw new Error(
    "HOME environment variable is not set. Please set it to your home directory.",
  );
}
const CONFIG_HOME = (Deno.env.get("XDG_CONFIG_HOME") || `${HOME}/.config`) +
  "/ageage";

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

  const args = parseArgs(Deno.args, {
    boolean: ["help", "version"],
    string: ["config", "agent"],
  });

  for (const path of [CONFIG_HOME + "/.env", "./.env"]) {
    try {
      await load({ export: true, envPath: path });
    } catch (error) {
      console.warn(
        `Warning: Failed to load environment variables from ${path}: ${error}`,
      );
    }
  }

  setApiKey();

  await loadConfig([
    CONFIG_HOME + "/config.yaml",
    "./config.yaml",
    ...(args.config ? [args.config] : []),
  ]);

  if (args.help) {
    console.log(`
Usage: ageage [options] [input_text]
Options:
  --help          Show this help message
  --version       Show version information
  --config <file> Specify a custom config file
  --agent <name>  Specify an agent to use (default: ${config.default_agent})
`);
    Deno.exit(0);
  }
  if (args.version) {
    console.log(`ageage version ${VERSION}`);
    Deno.exit(0);
  }

  const input_text_arg = args._.join(" ").trim();
  if (!is_tty && !input_text_arg) {
    console.error("No input provided");
    Deno.exit(1);
  }

  const stdin_reader = async function* () {
    if (input_text_arg) {
      yield input_text_arg;
    }
    if (!readline) {
      return;
    }

    for await (const line of readline) {
      yield line;
    }
  }();

  const printer = new Printer(0);

  readline?.prompt();

  if (args.agent && !(args.agent in config.agents)) {
    console.error(`Error: Agent "${args.agent}" not found in config.`);
    console.error(`Available agents: ${Object.keys(config.agents).join(", ")}`);
    Deno.exit(1);
  }
  const agent = config.agents[args.agent || config.default_agent];

  await runAgent(agent, stdin_reader, printer);
}

// Handle SIGINT (Ctrl+C)
function sigIntHandler() {
  Deno.exit(0); // Exit gracefully
}
Deno.addSignalListener("SIGINT", sigIntHandler);

await main();
