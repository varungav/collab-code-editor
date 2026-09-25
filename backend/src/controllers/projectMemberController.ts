import type { Request, Response } from 'express'
import { projectMemberService } from '../services/projectMemberService'
import { requireUserId } from '../utils/requireUser'

async function list(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const members = await projectMemberService.listMembers(req.params.projectId, userId)
  res.status(200).json(members)
}

async function add(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const member = await projectMemberService.addMember(req.params.projectId, userId, req.body ?? {})
  res.status(201).json(member)
}

async function updateRole(req: Request<{ projectId: string; userId: string }>, res: Response) {
  const requesterId = requireUserId(req)
  const member = await projectMemberService.updateMemberRole(
    req.params.projectId,
    requesterId,
    req.params.userId,
    req.body?.role,
  )
  res.status(200).json(member)
}

async function remove(req: Request<{ projectId: string; userId: string }>, res: Response) {
  const requesterId = requireUserId(req)
  await projectMemberService.removeMember(req.params.projectId, requesterId, req.params.userId)
  res.status(204).send()
}

export const projectMemberController = {
  list,
  add,
  updateRole,
  remove,
}
