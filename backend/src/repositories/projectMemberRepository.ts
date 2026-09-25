import type { ProjectMember, ProjectRole } from '@prisma/client'
import { prisma } from '../config/database'

export type MemberWithUser = ProjectMember & {
  user: { id: string; name: string; email: string }
}

function find(projectId: string, userId: string): Promise<ProjectMember | null> {
  return prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } })
}

function findAllForProject(projectId: string): Promise<MemberWithUser[]> {
  return prisma.projectMember.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
}

// Project ids this user belongs to in any role, for listing "my projects".
async function findProjectIdsForUser(userId: string): Promise<string[]> {
  const rows = await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } })
  return rows.map((row) => row.projectId)
}

// This user's memberships, each with its project attached — used to annotate
// "my projects" with the caller's own role in each one.
function findAllForUserWithProject(userId: string) {
  return prisma.projectMember.findMany({
    where: { userId },
    include: { project: true },
    orderBy: { project: { createdAt: 'asc' } },
  })
}

function create(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
  return prisma.projectMember.create({ data: { projectId, userId, role } })
}

function upsert(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
  return prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role },
    update: { role },
  })
}

// Join from a shared link; preserve any role the user already has.
function joinByLink(projectId: string, userId: string): Promise<ProjectMember> {
  return prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role: 'EDITOR' },
    update: {},
  })
}

function updateRole(projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> {
  return prisma.projectMember.update({ where: { projectId_userId: { projectId, userId } }, data: { role } })
}

async function remove(projectId: string, userId: string): Promise<void> {
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } })
}

export const projectMemberRepository = {
  find,
  findAllForProject,
  findProjectIdsForUser,
  findAllForUserWithProject,
  create,
  upsert,
  joinByLink,
  updateRole,
  remove,
}
