import { Request, Response, NextFunction } from 'express'
import { AnyZodObject, ZodError } from 'zod'
import { ApiResponse } from '../models/types'

export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })
      if (parsed.body !== undefined) req.body = parsed.body
      if (parsed.query !== undefined) req.query = parsed.query
      if (parsed.params !== undefined) req.params = parsed.params
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {}
        for (const issue of error.issues) {
          const key = issue.path.slice(1).join('.')
          errors[key] = errors[key] ? [...errors[key], issue.message] : [issue.message]
        }
        res.status(422).json({
          success: false,
          message: 'Datos inválidos',
          errors,
        } satisfies ApiResponse)
        return
      }
      next(error)
    }
  }
}
