import { Crayon, crayon } from "crayon";

const enc = new TextEncoder();

const INDENT_MARKER = crayon.dim("┃ ");

// TODO: support markdown formatting
// - bold
// - italic
// - strikethrough
// - code (syntax highlighting)

class Printer {
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
        await Deno.stdout.write(enc.encode(this.line_pref));
        this.in_line = true;
      }

      const line = lines[i];
      const nl = i < lines.length - 1 ? '\n' : "";
      this.in_line = false; // reset in_line for the next line
      await Deno.stdout.write(enc.encode(color(line + nl)));
    }
    if (last_newline) {
      await Deno.stdout.write(enc.encode("\n"));
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
      await this.write("\n");
    }
    return new Printer(this.depth + 1);
  }
}

export default Printer;
