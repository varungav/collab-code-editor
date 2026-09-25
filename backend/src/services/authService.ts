import bcrypt from 'bcryptjs'
import type { User } from '@prisma/client'
import { userRepository } from '../repositories/userRepository'
import { AppError } from '../utils/AppError'
import { signToken } from '../utils/jwt'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const PASSWORD_HASH_ROUNDS = 10

export type PublicUser = {
  id: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}

type AuthResult = {
  token: string
  user: PublicUser
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

async function register(input: { name?: string; email?: string; password?: string }): Promise<AuthResult> {
  const name = input.name?.trim()
  const email = input.email?.trim().toLowerCase()
  const password = input.password

  if (!name) {
    throw new AppError(400, 'Name is required')
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw new AppError(400, 'A valid email is required')
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const existing = await userRepository.findByEmail(email)
  if (existing) {
    throw new AppError(400, 'Email is already registered')
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS)
  const user = await userRepository.create({ name, email, passwordHash })

  return { token: signToken(user.id), user: toPublicUser(user) }
}

async function login(input: { email?: string; password?: string }): Promise<AuthResult> {
  const email = input.email?.trim().toLowerCase()
  const password = input.password

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required')
  }

  const user = await userRepository.findByEmail(email)
  if (!user) {
    throw new AppError(401, 'Invalid email or password')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    throw new AppError(401, 'Invalid email or password')
  }

  return { token: signToken(user.id), user: toPublicUser(user) }
}

async function getUserById(userId: string): Promise<PublicUser> {
  const user = await userRepository.findById(userId)
  if (!user) {
    throw new AppError(404, 'User not found')
  }
  return toPublicUser(user)
}

export const authService = {
  register,
  login,
  getUserById,
}
