import type { Project } from '@prisma/client'
import { prisma } from '../config/database'

function findById(id: string): Promise<Project | null> {
  return prisma.project.findUnique({ where: { id } })
}

function create(ownerId: string, name: string): Promise<Project> {
  return prisma.project.create({ data: { name, ownerId } })
}

export const projectRepository = {
  findById,
  create,
}
