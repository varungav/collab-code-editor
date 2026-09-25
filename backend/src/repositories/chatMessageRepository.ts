import { prisma } from '../config/database'

const HISTORY_LIMIT = 50

type ChatMessageWithAuthor = {
  id: string
  projectId: string
  userId: string
  message: string
  createdAt: Date
  user: { name: string }
}

function create(projectId: string, userId: string, message: string): Promise<ChatMessageWithAuthor> {
  return prisma.chatMessage.create({
    data: { projectId, userId, message },
    include: { user: { select: { name: true } } },
  })
}

// Most recent messages, returned oldest-first for chronological display.
async function findRecentByProject(projectId: string): Promise<ChatMessageWithAuthor[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    include: { user: { select: { name: true } } },
  })
  return messages.reverse()
}

export const chatMessageRepository = {
  create,
  findRecentByProject,
}
