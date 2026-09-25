import type { ProjectAccessRequest } from '@prisma/client'
import { accessRequestRepository } from '../repositories/accessRequestRepository'
import { projectMemberRepository } from '../repositories/projectMemberRepository'
import { projectRepository } from '../repositories/projectRepository'
import { AppError } from '../utils/AppError'
import { connectionManager } from '../websocket/connectionManager'
import { projectAuthorizationService } from './projectAuthorizationService'

async function requestAccess(
  projectId: string,
  requester: { id: string; name: string },
): Promise<ProjectAccessRequest> {
  const project = await projectRepository.findById(projectId)
  if (!project) {
    throw new AppError(404, 'Project not found')
  }

  const existingRole = await projectAuthorizationService.getProjectRole(requester.id, projectId)
  if (existingRole) {
    throw new AppError(400, 'You already have access to this project')
  }

  const existing = await accessRequestRepository.findByProjectAndRequester(projectId, requester.id)
  if (existing?.status === 'PENDING') {
    throw new AppError(400, 'Your access request is already pending')
  }

  const request = await accessRequestRepository.upsertPending(projectId, requester.id)

  // Best-effort real-time nudge; the owner also sees this via the REST list
  // endpoint (below) if they're not connected right now.
  connectionManager.sendToUser(project.ownerId, {
    type: 'access_requested',
    requestId: request.id,
    projectId: project.id,
    projectName: project.name,
    requesterId: requester.id,
    requesterName: requester.name,
  })

  return request
}

function listMyPendingIncoming(ownerId: string) {
  return accessRequestRepository.findPendingForOwner(ownerId)
}

async function respondToRequest(
  requestId: string,
  ownerId: string,
  decision: 'APPROVED' | 'DENIED',
): Promise<ProjectAccessRequest> {
  const request = await accessRequestRepository.findById(requestId)
  if (!request) {
    throw new AppError(404, 'Access request not found')
  }

  const project = await projectRepository.findById(request.projectId)
  if (!project || project.ownerId !== ownerId) {
    throw new AppError(404, 'Access request not found')
  }

  if (request.status !== 'PENDING') {
    throw new AppError(400, 'This request has already been resolved')
  }

  const updated = await accessRequestRepository.updateStatus(requestId, decision)

  if (decision === 'APPROVED') {
    // Approving via this legacy "request access" flow grants EDITOR by
    // default; the owner can adjust the role afterward from the members panel.
    await projectMemberRepository.upsert(request.projectId, request.requesterId, 'EDITOR')
  }

  connectionManager.sendToUser(request.requesterId, {
    type: decision === 'APPROVED' ? 'access_request_approved' : 'access_request_denied',
    projectId: project.id,
    projectName: project.name,
  })

  return updated
}

export const accessRequestService = {
  requestAccess,
  listMyPendingIncoming,
  respondToRequest,
}
