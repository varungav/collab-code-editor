import type { Project, ProjectRole } from '@prisma/client'
import { accessRequestRepository } from '../repositories/accessRequestRepository'
import { fileRepository } from '../repositories/fileRepository'
import { projectMemberRepository } from '../repositories/projectMemberRepository'
import { projectRepository } from '../repositories/projectRepository'
import { AppError } from '../utils/AppError'
import { projectAuthorizationService } from './projectAuthorizationService'

export type ProjectAccessStatus = 'member' | 'pending' | 'none'
export type ProjectWithRole = Project & { role: ProjectRole }

// Annotated with the caller's own role in each project, so the Dashboard can
// show "Owner"/"Editor"/"Viewer" instead of a generic "shared with you".
async function getAllProjects(userId: string): Promise<ProjectWithRole[]> {
  const memberships = await projectMemberRepository.findAllForUserWithProject(userId)
  return memberships.map((membership) => ({ ...membership.project, role: membership.role }))
}

// Enforces membership (any role) — 404 for non-members, matching the
// existing "don't reveal a project exists" stance from earlier phases.
async function getProjectById(projectId: string, userId: string): Promise<Project> {
  await projectAuthorizationService.requireMember(userId, projectId)
  const project = await projectRepository.findById(projectId)
  if (!project) {
    throw new AppError(404, 'Project not found')
  }
  return project
}

// Unlike getProjectById, this deliberately tells an authenticated user a
// project exists even when they can't open it yet, so the frontend can offer
// a "Request Access" screen instead of a bare 404.
async function getAccessStatus(
  projectId: string,
  userId: string,
): Promise<{ project: Project; status: ProjectAccessStatus; role: ProjectRole | null }> {
  const project = await projectRepository.findById(projectId)
  if (!project) {
    throw new AppError(404, 'Project not found')
  }

  const role = await projectAuthorizationService.getProjectRole(userId, projectId)
  if (role) {
    return { project, status: 'member', role }
  }

  const existing = await accessRequestRepository.findByProjectAndRequester(projectId, userId)
  if (existing?.status === 'PENDING') {
    return { project, status: 'pending', role: null }
  }
  return { project, status: 'none', role: null }
}

async function createProject(ownerId: string, name: string): Promise<Project> {
  if (!name || !name.trim()) {
    throw new AppError(400, 'Project name is required')
  }

  const project = await projectRepository.create(ownerId, name.trim())
  await projectMemberRepository.create(project.id, ownerId, 'OWNER')

  await fileRepository.create({
    projectId: project.id,
    name: 'README.md',
    path: 'README.md',
    language: 'markdown',
    content: `# ${project.name}\n`,
  })

  return project
}

export const projectService = {
  getAllProjects,
  getProjectById,
  getAccessStatus,
  createProject,
}
