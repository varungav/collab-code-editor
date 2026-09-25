export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type ProjectMember = {
  userId: string
  name: string
  email: string
  role: ProjectRole
}
