type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
}

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  log(level: LogLevel, message: string, meta?: any) {
    const logData: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (meta) {
      if (meta instanceof Error) {
        logData.meta = {
          name: meta.name,
          message: meta.message,
          stack: isProduction ? undefined : meta.stack,
        };
      } else {
        logData.meta = meta;
      }
    }

    if (isProduction) {
      // In production, print JSON logs for log aggregators (Render, Datadog, etc.)
      console.log(JSON.stringify(logData));
    } else {
      // In development, print human-readable formatted logs
      const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[36m';
      const reset = '\x1b[0m';
      const metaString = meta ? ` | Meta: ${JSON.stringify(logData.meta)}` : '';
      console.log(`[${logData.timestamp}] ${color}${level.toUpperCase()}${reset}: ${message}${metaString}`);
    }
  },

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  },

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  },

  error(message: string, meta?: any) {
    this.log('error', message, meta);
  },
};
