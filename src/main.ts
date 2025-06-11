import { crayon } from "crayon";
import { run } from "./screen.tsx";

console.log(crayon.green("Hello, world!"));

await run().waitUntilExit();
