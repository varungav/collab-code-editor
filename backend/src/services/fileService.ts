import { Prisma } from '@prisma/client'
import type { File } from '@prisma/client'
import { fileRepository } from '../repositories/fileRepository'
import { AppError } from '../utils/AppError'
import { projectAuthorizationService } from './projectAuthorizationService'

type CreateFileInput = {
  name: string
  path: string
  language: string
  content?: string
}

// Any project member (OWNER/EDITOR/VIEWER) can read; 404s for both "no such
// file" and "file belongs to a project you're not a member of" so neither
// case leaks more than the other.
async function getOwnedFile(fileId: string, userId: string): Promise<File> {
  const file = await fileRepository.findById(fileId)
  if (!file) {
    throw new AppError(404, 'File not found')
  }

  const role = await projectAuthorizationService.getProjectRole(userId, file.projectId)
  if (!role) {
    throw new AppError(404, 'File not found')
  }

  return file
}

// Same lookup as getOwnedFile, but additionally requires OWNER/EDITOR — used
// by every file-mutating operation. A VIEWER who is a legitimate member gets
// 403 (they know the file exists, they just can't change it); a non-member
// still gets 404.
async function getEditableFile(fileId: string, userId: string): Promise<File> {
  const file = await fileRepository.findById(fileId)
  if (!file) {
    throw new AppError(404, 'File not found')
  }

  await projectAuthorizationService.requireEditor(userId, file.projectId)
  return file
}

async function getFilesByProject(projectId: string, userId: string): Promise<File[]> {
  await projectAuthorizationService.requireMember(userId, projectId)
  return fileRepository.findByProjectId(projectId)
}

function getFileById(fileId: string, userId: string): Promise<File> {
  return getOwnedFile(fileId, userId)
}

async function createFile(projectId: string, userId: string, input: CreateFileInput): Promise<File> {
  await projectAuthorizationService.requireEditor(userId, projectId)

  if (!input.name || !input.name.trim()) {
    throw new AppError(400, 'File name is required')
  }
  if (!input.path || !input.path.trim()) {
    throw new AppError(400, 'File path is required')
  }
  if (!input.language || !input.language.trim()) {
    throw new AppError(400, 'File language is required')
  }

  try {
    return await fileRepository.create({
      projectId,
      name: input.name.trim(),
      path: input.path.trim(),
      language: input.language.trim(),
      content: input.content ?? '',
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(400, 'A file with this path already exists in the project')
    }
    throw err
  }
}

async function updateFileContent(fileId: string, userId: string, content: string): Promise<File> {
  await getEditableFile(fileId, userId)

  if (typeof content !== 'string') {
    throw new AppError(400, 'File content must be a string')
  }

  try {
    return await fileRepository.updateContent(fileId, content)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(404, 'File not found')
    }
    throw err
  }
}

async function deleteFile(fileId: string, userId: string): Promise<void> {
  await getEditableFile(fileId, userId)

  try {
    await fileRepository.remove(fileId)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(404, 'File not found')
    }
    throw err
  }
}

export const fileService = {
  getFilesByProject,
  getFileById,
  createFile,
  updateFileContent,
  deleteFile,
}
