import * as log from "@std/log";

export function setupLogger() {
  let loglevel = Deno.env.get("LOG_LEVEL") as log.LevelName || "INFO";
  if (log.LogLevelNames.indexOf(loglevel) === -1) {
    loglevel = "INFO"; // Default to INFO if invalid level
  }

  log.setup({
    handlers: {
      file: new log.FileHandler("DEBUG", {
        filename: "app.log",
        formatter: (record) => `[${record.levelName}] ${record.msg}`,
      }),
    },
    loggers: {
      default: {
        level: loglevel,
        handlers: ["file"],
      },
    },
  });
}
