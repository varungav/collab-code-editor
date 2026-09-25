import type { Request, Response } from 'express'
import { fileService } from '../services/fileService'
import { requireUserId } from '../utils/requireUser'

async function getByProject(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const files = await fileService.getFilesByProject(req.params.projectId, userId)
  res.status(200).json(files)
}

async function getOne(req: Request<{ fileId: string }>, res: Response) {
  const userId = requireUserId(req)
  const file = await fileService.getFileById(req.params.fileId, userId)
  res.status(200).json(file)
}

async function create(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const { name, path, language, content } = req.body ?? {}
  const file = await fileService.createFile(req.params.projectId, userId, { name, path, language, content })
  res.status(201).json(file)
}

async function update(req: Request<{ fileId: string }>, res: Response) {
  const userId = requireUserId(req)
  const file = await fileService.updateFileContent(req.params.fileId, userId, req.body?.content)
  res.status(200).json(file)
}

async function remove(req: Request<{ fileId: string }>, res: Response) {
  const userId = requireUserId(req)
  await fileService.deleteFile(req.params.fileId, userId)
  res.status(204).send()
}

export const fileController = {
  getByProject,
  getOne,
  create,
  update,
  remove,
}
