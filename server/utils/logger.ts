import fs from "node:fs";
import path from "node:path";

type LogLevel = "info" | "warn" | "error";

const logDir = process.env.LOG_DIR ?? "server/logs";
const logFile = process.env.LOG_FILE ?? path.join(logDir, "server.jsonl");

const ensureLogDir = () => {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // If we cannot create the directory, fallback to console only.
  }
};

const appendLine = (line: string) => {
  try {
    ensureLogDir();
    fs.appendFile(logFile, `${line}\n`, () => {});
  } catch {
    // Swallow file errors to avoid crashing the server.
  }
};

export const logJson = (
  level: LogLevel,
  event: string,
  data: Record<string, unknown>
) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data
  };
  const line = JSON.stringify(payload);
  console.log(line);
  appendLine(line);
};
