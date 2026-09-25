import type { NextFunction, Request, Response } from 'express'
import { userRepository } from '../repositories/userRepository'
import { AppError } from '../utils/AppError'
import { verifyToken } from '../utils/jwt'

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'Authentication required'))
    return
  }

  const token = header.slice('Bearer '.length).trim()

  let payload: { sub: string }
  try {
    payload = verifyToken(token)
  } catch {
    next(new AppError(401, 'Invalid or expired token'))
    return
  }

  const user = await userRepository.findById(payload.sub)
  if (!user) {
    next(new AppError(401, 'Invalid or expired token'))
    return
  }

  req.user = { id: user.id, name: user.name, email: user.email }
  next()
}
