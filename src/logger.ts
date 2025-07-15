import * as log from "@std/log";

const DefaultLogLevel: log.LevelName = "DEBUG";
export function setupLogger() {
  let loglevel = Deno.env.get("LOG_LEVEL") as log.LevelName || DefaultLogLevel;
  if (log.LogLevelNames.indexOf(loglevel) === -1) {
    loglevel = DefaultLogLevel;
  }

  log.setup({
    handlers: {
      file: new log.FileHandler("DEBUG", {
        filename: "app.log",
        formatter: (record) =>
          `[${record.levelName}] ${record.msg} ${formatArgs(record.args)}`,
      }),
    },
    loggers: {
      default: {
        level: loglevel,
        handlers: ["file", "console"],
      },
    },
  });

  // Flush log handlers on unload
  globalThis.addEventListener("unload", () => {
    log.getLogger().handlers.forEach((handler) => {
      if (handler instanceof log.FileHandler) {
        handler.flush();
      }
    });
  });
}

function formatArgs(args: unknown[]): string {
  return args.map((arg) => {
    if (typeof arg === "object") {
      return JSON.stringify(arg);
    }
    return String(arg);
  }).join(" ");
}
