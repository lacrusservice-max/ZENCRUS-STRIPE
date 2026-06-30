import winston from 'winston'
import { env } from './env'

const { combine, timestamp, json, colorize, simple, errors } = winston.format

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  defaultMeta: { service: 'nutriai-fit-api' },
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'production'
        ? combine(errors({ stack: true }), timestamp(), json())
        : combine(colorize(), simple()),
    }),
  ],
})

export { logger }
