import type { AccessRequestStatus, ProjectAccessRequest } from '@prisma/client'
import { prisma } from '../config/database'

function findByProjectAndRequester(projectId: string, requesterId: string): Promise<ProjectAccessRequest | null> {
  return prisma.projectAccessRequest.findUnique({
    where: { projectId_requesterId: { projectId, requesterId } },
  })
}

function findById(id: string): Promise<ProjectAccessRequest | null> {
  return prisma.projectAccessRequest.findUnique({ where: { id } })
}

function findApproved(projectId: string, requesterId: string): Promise<ProjectAccessRequest | null> {
  return prisma.projectAccessRequest.findFirst({
    where: { projectId, requesterId, status: 'APPROVED' },
  })
}

function findProjectIdsApprovedForUser(requesterId: string): Promise<{ projectId: string }[]> {
  return prisma.projectAccessRequest.findMany({
    where: { requesterId, status: 'APPROVED' },
    select: { projectId: true },
  })
}

function findPendingByProject(projectId: string): Promise<(ProjectAccessRequest & { requester: { id: string; name: string; email: string } })[]> {
  return prisma.projectAccessRequest.findMany({
    where: { projectId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { requester: { select: { id: true, name: true, email: true } } },
  })
}

function findPendingForOwner(ownerId: string): Promise<
  (ProjectAccessRequest & { requester: { id: string; name: string; email: string }; project: { id: string; name: string } })[]
> {
  return prisma.projectAccessRequest.findMany({
    where: { status: 'PENDING', project: { ownerId } },
    orderBy: { createdAt: 'asc' },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  })
}

// Upserts so a previously denied request can be re-raised by simply asking
// again; approving/denying always operates on this same one row per pair.
function upsertPending(projectId: string, requesterId: string): Promise<ProjectAccessRequest> {
  return prisma.projectAccessRequest.upsert({
    where: { projectId_requesterId: { projectId, requesterId } },
    create: { projectId, requesterId, status: 'PENDING' },
    update: { status: 'PENDING' },
  })
}

function updateStatus(id: string, status: AccessRequestStatus): Promise<ProjectAccessRequest> {
  return prisma.projectAccessRequest.update({ where: { id }, data: { status } })
}

export const accessRequestRepository = {
  findByProjectAndRequester,
  findById,
  findApproved,
  findProjectIdsApprovedForUser,
  findPendingByProject,
  findPendingForOwner,
  upsertPending,
  updateStatus,
}
