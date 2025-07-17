import { Crayon, crayon } from "crayon";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { unicodeWidth } from "@std/cli/unicode-width";

export const is_tty = Deno.stdin.isTerminal();

const enc = new TextEncoder();

export const readline = is_tty
  ? createInterface({
    input: stdin,
    output: stdout,
    prompt: "> ",
    terminal: true,
  })
  : null;

readline?.on("line", async () => {
  await Deno.stdout.write(enc.encode("\n"));
  readline.prompt();
});

readline?.on("SIGINT", async () => {
  const ret = await readline.question("Are you sure you want to exit? ");
  if (ret.match(/^y(es)?$/i)) {
    readline.pause();
    Deno.exit(1);
  }
  readline.prompt();
});

// deno-lint-ignore no-control-regex
const ANSI_REGEX = /\x1B\[[0-?]*[ -/]*[@-~]/y;
function truncateWidth(str: string, width: number): string {
  let sum = 0;
  let i = 0;

  while (i < str.length) {
    ANSI_REGEX.lastIndex = i;
    const m = ANSI_REGEX.exec(str);
    if (m && m.index === i) {
      i += m[0].length;
      continue;
    }

    // NOTE: `codePointAt` is used to handle characters that are represented by multiple code units (like emojis).
    const ch = String.fromCodePoint(str.codePointAt(i)!);
    const w = unicodeWidth(ch);

    if (sum + w > width) break;

    sum += w;
    i += ch.length;
  }

  return str.slice(0, i) + "\x1b[0m"; // reset ANSI codes
}

let buf = "";
async function print(msg: string) {
  if (!readline) {
    await Deno.stdout.write(enc.encode(msg));
    return;
  }

  buf += msg;

  const lines = buf.split("\n");
  // truncate the last line to fit in the terminal width
  lines[lines.length - 1] = truncateWidth(
    lines[lines.length - 1],
    Deno.consoleSize().columns - 1,
  );

  // clear line on CR
  const buf2 = lines.join("\n\x1b[K");

  // move cursor up, clear line, content, move cursor down, render prompt
  const seq =
    `\x1b[1F\x1b[2K${buf2}\n${readline.getPrompt()}${readline.line}\x1b[${
      readline.cursor + 3
    }G`;

  await Deno.stdout.write(enc.encode(seq));

  // keep only the last line
  buf = buf.substring(buf.lastIndexOf("\n") + 1);

  // readline.prompt(true);
}

const INDENT_MARKER = crayon.dim("┃ ");

// TODO: support markdown formatting
// - bold
// - italic
// - strikethrough
// - code (syntax highlighting)

export class Printer {
  depth: number;
  in_line: boolean = false; // whether we are currently in a line of output

  line_pref: string;

  constructor(depth = 0) {
    this.depth = depth;
    this.line_pref = INDENT_MARKER.repeat(depth);
  }

  async write(s: string, color: Crayon = crayon.reset): Promise<void> {
    const lines = s.split("\n");
    let last_newline = false;
    if (lines[lines.length - 1] === "") {
      lines.pop();
      last_newline = true;
    }
    for (let i = 0; i < lines.length; i++) {
      // print the line prefix if we are not already in a line
      if (!this.in_line) {
        await print(this.line_pref);
        this.in_line = true;
      }

      const line = lines[i];
      const nl = i < lines.length - 1 ? "\n" : "";
      this.in_line = false; // reset in_line for the next line
      await print(color(line + nl));
    }
    if (last_newline) {
      await print("\n");
      // if the last line was a newline, we need to reset in_line
      this.in_line = false;
    } else {
      // otherwise, we need to set in_line to true for the next write
      this.in_line = true;
    }
  }

  // make a new Printer with increased depth
  async get_deep(): Promise<Printer> {
    if (this.in_line) {
      await print("\n");
      this.in_line = false;
    }
    return new Printer(this.depth + 1);
  }
}

// export default Printer;
