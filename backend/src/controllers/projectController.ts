import type { Request, Response } from 'express'
import { projectService } from '../services/projectService'
import { requireUserId } from '../utils/requireUser'

async function getAll(req: Request, res: Response) {
  const userId = requireUserId(req)
  const projects = await projectService.getAllProjects(userId)
  res.status(200).json(projects)
}

async function getOne(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const project = await projectService.getProjectById(req.params.projectId, userId)
  res.status(200).json(project)
}

async function joinByLink(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  await projectService.joinProjectByLink(req.params.projectId, userId)
  res.status(204).end()
}

async function create(req: Request, res: Response) {
  const userId = requireUserId(req)
  const project = await projectService.createProject(userId, req.body?.name)
  res.status(201).json(project)
}

export const projectController = {
  getAll,
  getOne,
  joinByLink,
  create,
}
