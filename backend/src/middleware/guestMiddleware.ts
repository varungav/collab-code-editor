import type { NextFunction, Request, Response } from 'express'
import { userRepository } from '../repositories/userRepository'
import { AppError } from '../utils/AppError'

// Replaces JWT auth: accepts X-Guest-Id + X-Guest-Name headers.
// Auto-creates a user row on first visit so the rest of the app (which
// expects real user IDs in the DB) works without any other changes.
export async function guestMiddleware(req: Request, _res: Response, next: NextFunction) {
  const guestId = req.headers['x-guest-id']
  const guestName = req.headers['x-guest-name']

  if (typeof guestId !== 'string' || !guestId || typeof guestName !== 'string' || !guestName) {
    next(new AppError(401, 'Guest identity required (X-Guest-Id and X-Guest-Name headers)'))
    return
  }

  // Use a synthetic email so it fits the unique constraint without real auth
  const email = `guest-${guestId}@guest.local`

  let user = await userRepository.findById(guestId)
  if (!user) {
    // First time this guest visits — create a persistent row so FK constraints hold
    user = await userRepository.upsertGuest({ id: guestId, name: guestName, email })
  } else if (user.name !== guestName) {
    // Name changed — update it
    user = await userRepository.updateName(guestId, guestName)
  }

  req.user = { id: user.id, name: user.name, email: user.email }
  next()
}
