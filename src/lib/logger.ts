type LogLevel = "info" | "warn" | "error";

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => !/secret|key|token|prompt|signature/i.test(key)));
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safe });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
