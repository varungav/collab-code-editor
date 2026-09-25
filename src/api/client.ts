import { getToken } from '../auth/tokenStore'
import type { IncomingAccessRequest, ProjectAccess } from '../types/access'
import type { AuthUser } from '../types/auth'
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
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
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

type AuthResponse = {
  token: string
  user: AuthUser
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>('/auth/me'),

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

  getProjectMessages: (projectId: string) => request<ChatMessage[]>(`/projects/${projectId}/messages`),

  getProjectAccess: (projectId: string) => request<ProjectAccess>(`/projects/${projectId}/access`),
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
