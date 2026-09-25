import type { User } from '@prisma/client'
import { prisma } from '../config/database'

type CreateUserData = {
  name: string
  email: string
  passwordHash: string
}

type GuestUserData = {
  id: string
  name: string
  email: string
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

// Creates a guest user with a pre-assigned ID (stored in the browser).
// Uses upsert so concurrent first-requests from the same guest don't race.
function upsertGuest(data: GuestUserData): Promise<User> {
  return prisma.user.upsert({
    where: { id: data.id },
    update: { name: data.name },
    create: { id: data.id, name: data.name, email: data.email, passwordHash: '' },
  })
}

function updateName(id: string, name: string): Promise<User> {
  return prisma.user.update({ where: { id }, data: { name } })
}

export const userRepository = {
  findByEmail,
  findById,
  create,
  upsertGuest,
  updateName,
}
