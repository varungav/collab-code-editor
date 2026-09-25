import type { ProjectRole } from '@prisma/client'
import { projectMemberRepository } from '../repositories/projectMemberRepository'
import { AppError } from '../utils/AppError'

// The single place every REST endpoint and every WebSocket handler asks
// "can this user do this to this project" — nothing else in the codebase
// should read ProjectMember rows or compare Project.ownerId directly for
// authorization decisions.

function canEditRole(role: ProjectRole | null): boolean {
  return role === 'OWNER' || role === 'EDITOR'
}

function canManageMembersRole(role: ProjectRole | null): boolean {
  return role === 'OWNER'
}

function getProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
  return projectMemberRepository.find(projectId, userId).then((member) => member?.role ?? null)
}

// Throws 404 (not 403) for non-members, so a project's existence is never
// revealed to someone with no relationship to it at all.
async function requireMember(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await getProjectRole(userId, projectId)
  if (!role) {
    throw new AppError(404, 'Project not found')
  }
  return role
}

// For someone who IS a member but lacks a permission, 403 is correct — they
// already know the project exists, they're just not allowed this action.
async function requireEditor(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireMember(userId, projectId)
  if (!canEditRole(role)) {
    throw new AppError(403, 'You do not have permission to edit this project')
  }
  return role
}

async function requireOwner(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireMember(userId, projectId)
  if (role !== 'OWNER') {
    throw new AppError(403, 'Only the project owner can do this')
  }
  return role
}

export const projectAuthorizationService = {
  getProjectRole,
  canEditRole,
  canManageMembersRole,
  requireMember,
  requireEditor,
  requireOwner,
}
