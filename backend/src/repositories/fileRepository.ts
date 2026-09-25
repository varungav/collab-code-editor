import type { File } from '@prisma/client'
import { prisma } from '../config/database'

type CreateFileData = {
  projectId: string
  name: string
  path: string
  language: string
  content: string
}

function findById(id: string): Promise<File | null> {
  return prisma.file.findUnique({ where: { id } })
}

function findByProjectId(projectId: string): Promise<File[]> {
  return prisma.file.findMany({ where: { projectId }, orderBy: { path: 'asc' } })
}

function create(data: CreateFileData): Promise<File> {
  return prisma.file.create({ data })
}

function updateContent(id: string, content: string): Promise<File> {
  return prisma.file.update({ where: { id }, data: { content } })
}

function updatePath(id: string, data: { name: string; path: string }): Promise<File> {
  return prisma.file.update({ where: { id }, data })
}

async function remove(id: string): Promise<void> {
  await prisma.file.delete({ where: { id } })
}

export const fileRepository = {
  findById,
  findByProjectId,
  create,
  updateContent,
  updatePath,
  remove,
}
