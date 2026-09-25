import type { NextFunction, Request, Response } from 'express'
import { AppError } from './AppError'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  // body-parser (express.json) throws plain errors with a `status`/`type`
  // for malformed or oversized request bodies — surface those as clean 4xx
  // JSON instead of falling through to a generic 500.
  if (isBodyParserError(err)) {
    res.status(err.status).json({ error: err.type === 'entity.too.large' ? 'Request body too large' : 'Malformed request body' })
    return
  }

  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}

function isBodyParserError(err: unknown): err is { status: number; type?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 500
  )
}
