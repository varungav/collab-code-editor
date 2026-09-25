import type { ProjectRole } from '@prisma/client'
import { projectMemberRepository } from '../repositories/projectMemberRepository'
import { projectRepository } from '../repositories/projectRepository'
import { userRepository } from '../repositories/userRepository'
import { AppError } from '../utils/AppError'
import { projectAuthorizationService } from './projectAuthorizationService'

export type MemberDto = {
  userId: string
  name: string
  email: string
  role: ProjectRole
}

const ASSIGNABLE_ROLES: ProjectRole[] = ['EDITOR', 'VIEWER']

function isAssignableRole(role: unknown): role is ProjectRole {
  return typeof role === 'string' && ASSIGNABLE_ROLES.includes(role as ProjectRole)
}

// Any member (including a VIEWER) can see who else is on the project — it's
// not sensitive information, and the frontend needs it to render presence
// alongside roles.
async function listMembers(projectId: string, userId: string): Promise<MemberDto[]> {
  await projectAuthorizationService.requireMember(userId, projectId)
  const members = await projectMemberRepository.findAllForProject(projectId)
  return members.map((member) => ({
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
  }))
}

async function addMember(
  projectId: string,
  ownerId: string,
  input: { email?: unknown; role?: unknown },
): Promise<MemberDto> {
  await projectAuthorizationService.requireOwner(ownerId, projectId)

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!email) {
    throw new AppError(400, 'Email is required')
  }
  if (!isAssignableRole(input.role)) {
    throw new AppError(400, 'Role must be EDITOR or VIEWER')
  }

  const targetUser = await userRepository.findByEmail(email)
  if (!targetUser) {
    throw new AppError(404, 'No registered user was found with that email')
  }

  const existingRole = await projectAuthorizationService.getProjectRole(targetUser.id, projectId)
  if (existingRole) {
    throw new AppError(400, 'That user is already a member of this project')
  }

  const member = await projectMemberRepository.create(projectId, targetUser.id, input.role)
  return { userId: targetUser.id, name: targetUser.name, email: targetUser.email, role: member.role }
}

async function updateMemberRole(
  projectId: string,
  ownerId: string,
  targetUserId: string,
  role: unknown,
): Promise<MemberDto> {
  await projectAuthorizationService.requireOwner(ownerId, projectId)

  if (!isAssignableRole(role)) {
    throw new AppError(400, 'Role must be EDITOR or VIEWER')
  }

  const project = await projectRepository.findById(projectId)
  if (project?.ownerId === targetUserId) {
    throw new AppError(400, "The project owner's role cannot be changed")
  }

  const existing = await projectMemberRepository.find(projectId, targetUserId)
  if (!existing) {
    throw new AppError(404, 'That user is not a member of this project')
  }

  const updated = await projectMemberRepository.updateRole(projectId, targetUserId, role)
  const targetUser = await userRepository.findById(targetUserId)
  return { userId: targetUserId, name: targetUser?.name ?? '', email: targetUser?.email ?? '', role: updated.role }
}

async function removeMember(projectId: string, ownerId: string, targetUserId: string): Promise<void> {
  await projectAuthorizationService.requireOwner(ownerId, projectId)

  const project = await projectRepository.findById(projectId)
  if (project?.ownerId === targetUserId) {
    throw new AppError(400, 'The project owner cannot be removed — ownership transfer is not supported yet')
  }

  const existing = await projectMemberRepository.find(projectId, targetUserId)
  if (!existing) {
    throw new AppError(404, 'That user is not a member of this project')
  }

  await projectMemberRepository.remove(projectId, targetUserId)
}

export const projectMemberService = {
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
}
