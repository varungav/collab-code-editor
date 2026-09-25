import type { Request, Response } from 'express'
import { accessRequestService } from '../services/accessRequestService'
import { projectService } from '../services/projectService'
import { requireUser, requireUserId } from '../utils/requireUser'

async function getAccessStatus(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const { project, status, role } = await projectService.getAccessStatus(req.params.projectId, userId)
  res.status(200).json({ projectId: project.id, projectName: project.name, status, role })
}

async function requestAccess(req: Request<{ projectId: string }>, res: Response) {
  const user = requireUser(req)
  const request = await accessRequestService.requestAccess(req.params.projectId, {
    id: user.id,
    name: user.name,
  })
  res.status(201).json(request)
}

async function listIncoming(req: Request, res: Response) {
  const userId = requireUserId(req)
  const requests = await accessRequestService.listMyPendingIncoming(userId)
  res.status(200).json(requests)
}

async function approve(req: Request<{ requestId: string }>, res: Response) {
  const userId = requireUserId(req)
  const request = await accessRequestService.respondToRequest(req.params.requestId, userId, 'APPROVED')
  res.status(200).json(request)
}

async function deny(req: Request<{ requestId: string }>, res: Response) {
  const userId = requireUserId(req)
  const request = await accessRequestService.respondToRequest(req.params.requestId, userId, 'DENIED')
  res.status(200).json(request)
}

export const accessRequestController = {
  getAccessStatus,
  requestAccess,
  listIncoming,
  approve,
  deny,
}
