import { getGuestId, getGuestName } from '../auth/guestStore'
import type { IncomingAccessRequest, ProjectAccess } from '../types/access'
import type { ChatMessage } from '../types/chat'
import type { FileItem, Project } from '../types/file'
import type { ProjectMember, ProjectRole } from '../types/members'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const guestId = getGuestId()
  const guestName = getGuestName() ?? 'Guest'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Guest-Id': guestId,
    'X-Guest-Name': guestName,
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, body?.error ?? `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  getProjects: () => request<Project[]>('/projects'),
  createProject: (name: string) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  getProjectFiles: (projectId: string) => request<FileItem[]>(`/projects/${projectId}/files`),
  createFile: (projectId: string, input: { name: string; path: string; language: string; content?: string }) =>
    request<FileItem>(`/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getFile: (fileId: string) => request<FileItem>(`/files/${fileId}`),
  updateFileContent: (fileId: string, content: string) =>
    request<FileItem>(`/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  renameFile: (fileId: string, path: string) =>
    request<FileItem>(`/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ path }),
    }),
  deleteFile: (fileId: string) => request<void>(`/files/${fileId}`, { method: 'DELETE' }),

  getProjectMessages: (projectId: string) => request<ChatMessage[]>(`/projects/${projectId}/messages`),

  getProjectAccess: (projectId: string) => request<ProjectAccess>(`/projects/${projectId}/access`),
  joinProjectByLink: (projectId: string) =>
    request<void>(`/projects/${projectId}/join`, { method: 'POST' }),
  requestProjectAccess: (projectId: string) =>
    request<void>(`/projects/${projectId}/access-requests`, { method: 'POST' }),
  listIncomingAccessRequests: () => request<IncomingAccessRequest[]>('/access-requests'),
  approveAccessRequest: (requestId: string) =>
    request<void>(`/access-requests/${requestId}/approve`, { method: 'POST' }),
  denyAccessRequest: (requestId: string) =>
    request<void>(`/access-requests/${requestId}/deny`, { method: 'POST' }),

  getProjectMembers: (projectId: string) => request<ProjectMember[]>(`/projects/${projectId}/members`),
  addProjectMember: (projectId: string, email: string, role: ProjectRole) =>
    request<ProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  updateMemberRole: (projectId: string, userId: string, role: ProjectRole) =>
    request<ProjectMember>(`/projects/${projectId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (projectId: string, userId: string) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
}
