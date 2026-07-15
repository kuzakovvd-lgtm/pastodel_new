const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const ALLOWED_FIELDS = new Set([
  "requestId",
  "formId",
  "status",
  "outcome",
  "durationMs",
  "reasonCode",
]);

const sanitizeLogValue = (value) => {
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value ?? "")
    .replace(/[\r\n\0-\x1f\x7f]+/g, "_")
    .slice(0, 120);
};

export const createLogger = ({
  level = "info",
  stream = process.stdout,
  now = () => new Date(),
} = {}) => {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const write = (logLevel, event, fields = {}) => {
    if ((LEVELS[logLevel] ?? LEVELS.info) < threshold) return;
    const entry = {
      timestamp: now().toISOString(),
      level: logLevel,
      event: sanitizeLogValue(event),
    };
    for (const [key, value] of Object.entries(fields)) {
      if (ALLOWED_FIELDS.has(key) && value !== undefined) {
        entry[key] = sanitizeLogValue(value);
      }
    }
    stream.write(`${JSON.stringify(entry)}\n`);
  };

  return Object.freeze({
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  });
};
