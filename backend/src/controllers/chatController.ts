import type { Request, Response } from 'express'
import { chatService } from '../services/chatService'
import { requireUserId } from '../utils/requireUser'

async function getHistory(req: Request<{ projectId: string }>, res: Response) {
  const userId = requireUserId(req)
  const messages = await chatService.getHistory(req.params.projectId, userId)
  res.status(200).json(messages)
}

export const chatController = {
  getHistory,
}
