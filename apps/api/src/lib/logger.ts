import pino from 'pino';

/**
 * Structured logger for the API and worker. Outputs JSON in production
 * (easy to ingest into any log aggregator) and pretty-printed lines in
 * development for local readability.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  // Defense-in-depth redaction for secret-shaped field names across arbitrary depth.
  redact: {
    paths: [
      'password',
      '*.password',
      '**.password',
      'token',
      '*.token',
      '**.token',
      'secret',
      '*.secret',
      '**.secret',
      'apiKey',
      '*.apiKey',
      '**.apiKey',
      'accessToken',
      '*.accessToken',
      'refreshToken',
      '*.refreshToken',
      'clientSecret',
      '*.clientSecret',
      'privateKey',
      '*.privateKey',
      'authorization',
      '*.authorization',
      'headers.authorization',
      '*.headers.authorization',
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
