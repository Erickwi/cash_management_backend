const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function timestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug: (msg: string, ...args: any[]) => {
    if (shouldLog('debug')) console.log(`[${timestamp()}] [DEBUG] ${msg}`, ...args);
  },
  info: (msg: string, ...args: any[]) => {
    if (shouldLog('info')) console.log(`[${timestamp()}] [INFO] ${msg}`, ...args);
  },
  warn: (msg: string, ...args: any[]) => {
    if (shouldLog('warn')) console.warn(`[${timestamp()}] [WARN] ${msg}`, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    if (shouldLog('error')) console.error(`[${timestamp()}] [ERROR] ${msg}`, ...args);
  },
};
