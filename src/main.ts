import { crayon } from "crayon";
// import { run } from "./screen.tsx";
import { runAgent } from "./agent/index.ts";
import { config } from "./config.ts";

console.log(crayon.green("Hello, world!"));

// await run().waitUntilExit();

const enc = new TextEncoder();
const ret = await runAgent(
  config.agents.default,
  "Use the calculator tool to calculate 2 ** 5.",
  (message: string) => Deno.stdout.write(enc.encode(message)),
  () => Promise.resolve(null),
);

console.log("Agent result:", ret);
