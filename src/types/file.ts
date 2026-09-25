import type { ProjectRole } from './members'

export type Project = {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
  role: ProjectRole
}

export type FileItem = {
  id: string
  projectId: string
  name: string
  path: string
  language: string
  content: string
  createdAt: string
  updatedAt: string
}

export type FileTreeNode =
  | { type: 'folder'; name: string; path: string; children: FileTreeNode[] }
  | { type: 'file'; name: string; path: string; file: FileItem }
