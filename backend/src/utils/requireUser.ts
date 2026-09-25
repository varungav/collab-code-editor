import type { Request } from 'express'
import { AppError } from './AppError'

export function requireUser(req: Request): { id: string; name: string; email: string } {
  if (!req.user) {
    throw new AppError(401, 'Authentication required')
  }
  return req.user
}

export function requireUserId(req: Request): string {
  return requireUser(req).id
}
