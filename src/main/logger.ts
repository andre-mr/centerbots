import fs from "fs";
import path from "path";
import { app } from "electron";

type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

const MAX_LINES = 1000;
const TRIM_TO = 800;
let lineCount = 0;
let initialized = false;
let logFilePath: string;
let writing = false;
const queue: string[] = [];

function init() {
  if (initialized) return;
  const dir = app.getPath("userData");
  logFilePath = path.join(dir, "centerbots.log");
  if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, "");
    lineCount = 0;
  } else {
    try {
      const data = fs.readFileSync(logFilePath, "utf8");
      lineCount = data === "" ? 0 : data.split(/\r?\n/).length;
    } catch {
      lineCount = 0;
    }
  }
  initialized = true;
}

function format(level: Level, msg: any, extra?: any) {
  const ts = new Date().toLocaleString();
  const header = `----- ${ts} [${level}] --------------------------------`;
  const body = typeof msg === "string" ? msg : safeSerialize(msg);
  const tail = extra ? "\n" + safeSerialize(extra) : "";
  return `${header}\n${body}${tail}\n`;
}

function safeSerialize(v: any) {
  try {
    if (v instanceof Error) {
      return `${v.name}: ${v.message}\n${v.stack || ""}`;
    }
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  } catch {
    return "[Unserializable]";
  }
}

async function flushQueue() {
  if (writing) return;
  writing = true;
  try {
    while (queue.length) {
      const chunk = queue.shift()!;
      fs.appendFileSync(logFilePath, chunk, "utf8");
      lineCount += chunk.split(/\n/).length - 1;
      if (lineCount > MAX_LINES) {
        try {
          const data = fs.readFileSync(logFilePath, "utf8");
          const lines = data.split(/\r?\n/);
          const trimmed = lines.slice(-TRIM_TO).join("\n");
          fs.writeFileSync(
            logFilePath,
            trimmed + (trimmed.endsWith("\n") ? "" : "\n")
          );
          lineCount = trimmed.split(/\r?\n/).length;
        } catch {
          // ignore trimming errors
        }
      }
    }
  } finally {
    writing = false;
  }
}

function push(level: Level, msg: any, extra?: any) {
  if (!initialized) init();
  queue.push(format(level, msg, extra));
  // microtask / leve debounce
  setImmediate(flushQueue);
}

export const logger = {
  info: (m: any, e?: any) => push("INFO", m, e),
  warn: (m: any, e?: any) => push("WARN", m, e),
  error: (m: any, e?: any) => push("ERROR", m, e),
  debug: (m: any, e?: any) => {
    if (process.env.CENTERBOTS_DEBUG) push("DEBUG", m, e);
  },
  getLogFilePath: () => {
    if (!initialized) init();
    return logFilePath;
  },
};
