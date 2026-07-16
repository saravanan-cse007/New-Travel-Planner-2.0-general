// Dev-only logger. In production builds (NODE_ENV === "production"),
// these calls are no-ops so we don't leak debug data into browser logs.
const isDev = process.env.NODE_ENV !== "production";

export const log = {
  warn: (...args) => { if (isDev) console.warn(...args); },
  error: (...args) => { if (isDev) console.error(...args); },
};
