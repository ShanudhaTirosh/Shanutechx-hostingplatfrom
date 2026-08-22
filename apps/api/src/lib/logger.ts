import pino from 'pino';

/**
 * Structured logger for the API and worker. Outputs JSON in production
 * (easy to ingest into any log aggregator) and pretty-printed lines in
 * development for local readability.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Defense-in-depth redaction (audit finding H5) for any code that logs
  // a raw object containing one of these common secret-shaped field
  // names, in addition to the header redaction configured on the
  // pino-http instance in index.ts.
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.accessToken',
      '*.refreshToken',
      '*.clientSecret',
      '*.serviceRoleKey',
      '*.privateKey',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
