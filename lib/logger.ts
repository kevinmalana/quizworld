/**
 * Production-safe logger.
 * In development: logs to console.
 * In production: sends to error tracking service (TODO: integrate Sentry).
 */

type LogLevel = "error" | "warn" | "info";

function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (level === "error") return true; // Always log errors
  return false;
}

export const logger = {
  error(message: string, context?: Record<string, unknown>) {
    if (shouldLog("error")) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[QuizWorld] ${message}`, context ?? "");
      }
      // TODO: Send to Sentry/LogRocket/etc in production
      // captureException(message, context);
    }
  },

  warn(message: string, context?: Record<string, unknown>) {
    if (shouldLog("warn")) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[QuizWorld] ${message}`, context ?? "");
      }
    }
  },

  info(message: string, context?: Record<string, unknown>) {
    if (shouldLog("info")) {
      if (process.env.NODE_ENV === "development") {
        console.log(`[QuizWorld] ${message}`, context ?? "");
      }
    }
  },
};
