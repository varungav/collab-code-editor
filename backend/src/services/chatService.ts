import { chatMessageRepository } from '../repositories/chatMessageRepository'
import { projectService } from './projectService'

export type ChatMessageDto = {
  id: string
  userId: string
  userName: string
  message: string
  createdAt: string
}

function toDto(row: {
  id: string
  userId: string
  message: string
  createdAt: Date
  user: { name: string }
}): ChatMessageDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  }
}

async function getHistory(projectId: string, userId: string): Promise<ChatMessageDto[]> {
  await projectService.getProjectById(projectId, userId)
  const rows = await chatMessageRepository.findRecentByProject(projectId)
  return rows.map(toDto)
}

// Called from the WebSocket message handler after a test_message is
// broadcast, so the room's chat history survives a refresh.
async function recordMessage(projectId: string, userId: string, message: string): Promise<ChatMessageDto> {
  const row = await chatMessageRepository.create(projectId, userId, message)
  return toDto(row)
}

export const chatService = {
  getHistory,
  recordMessage,
}
