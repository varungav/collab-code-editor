import type { User } from '@prisma/client'
import { prisma } from '../config/database'

type CreateUserData = {
  name: string
  email: string
  passwordHash: string
}

function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } })
}

function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } })
}

function create(data: CreateUserData): Promise<User> {
  return prisma.user.create({ data })
}

export const userRepository = {
  findByEmail,
  findById,
  create,
}
