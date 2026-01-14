import fs from "node:fs";
import path from "node:path";

type LogLevel = "info" | "warn" | "error";

const logDir = process.env.LOG_DIR ?? "server/logs";
const logFile = process.env.LOG_FILE ?? path.join(logDir, "server.jsonl");
const LOG_RETENTION_DAYS = Math.max(
  1,
  Number(process.env.LOG_RETENTION_DAYS ?? 15)
);
const DAY_MS = 24 * 60 * 60 * 1000;
let lastCleanupAt = 0;

const ensureLogDir = () => {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // If we cannot create the directory, fallback to console only.
  }
};

const pruneLogFile = (filePath: string, cutoffMs: number) => {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return;
    const lines = raw.split(/\r?\n/);
    const kept: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { ts?: string };
        const ts = parsed?.ts;
        if (typeof ts === "string") {
          const tsMs = Date.parse(ts);
          if (Number.isFinite(tsMs) && tsMs < cutoffMs) {
            continue;
          }
        }
      } catch {
        // Drop unparsable lines during cleanup.
        continue;
      }
      kept.push(line);
    }

    const next = kept.length ? `${kept.join("\n")}\n` : "";
    if (next !== raw) {
      fs.writeFileSync(filePath, next, "utf8");
    }
  } catch {
    // Ignore cleanup errors.
  }
};

const cleanupOldLogs = () => {
  const now = Date.now();
  if (now - lastCleanupAt < DAY_MS) return;
  lastCleanupAt = now;
  const cutoffMs = now - LOG_RETENTION_DAYS * DAY_MS;

  try {
    ensureLogDir();
    const entries = fs.readdirSync(logDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      const fullPath = path.join(logDir, entry.name);
      if (path.resolve(fullPath) === path.resolve(logFile)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoffMs) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch {
    // Ignore cleanup errors.
  }

  pruneLogFile(logFile, cutoffMs);
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
  cleanupOldLogs();
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
