import type { ProjectRole } from './members'

export type ProjectAccessStatus = 'member' | 'pending' | 'none'

export type ProjectAccess = {
  projectId: string
  projectName: string
  status: ProjectAccessStatus
  role: ProjectRole | null
}

export type IncomingAccessRequest = {
  id: string
  projectId: string
  requesterId: string
  status: 'PENDING' | 'APPROVED' | 'DENIED'
  createdAt: string
  requester: { id: string; name: string; email: string }
  project: { id: string; name: string }
}
