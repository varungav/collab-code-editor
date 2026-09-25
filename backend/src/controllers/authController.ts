import type { Request, Response } from 'express'
import { authService } from '../services/authService'
import { requireUserId } from '../utils/requireUser'

async function register(req: Request, res: Response) {
  const { name, email, password } = req.body ?? {}
  const result = await authService.register({ name, email, password })
  res.status(201).json(result)
}

async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {}
  const result = await authService.login({ email, password })
  res.status(200).json(result)
}

async function me(req: Request, res: Response) {
  const userId = requireUserId(req)
  const user = await authService.getUserById(userId)
  res.status(200).json(user)
}

export const authController = {
  register,
  login,
  me,
}
