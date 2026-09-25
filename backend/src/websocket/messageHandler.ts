import type { RawData, WebSocket } from 'ws'
import { chatService } from '../services/chatService'
import { fileService } from '../services/fileService'
import { projectAuthorizationService } from '../services/projectAuthorizationService'
import { projectService } from '../services/projectService'
import { connectionManager } from './connectionManager'
import type { ClientMessage, ServerMessage, WsUser } from './types'
import { yjsRoomManager } from './yjsRoomManager'

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: 'error', message })
}

export async function handleClientMessage(ws: WebSocket, user: WsUser, raw: RawData): Promise<void> {
  let message: ClientMessage
  try {
    message = JSON.parse(raw.toString())
  } catch {
    sendError(ws, 'Message must be valid JSON')
    return
  }

  switch (message.type) {
    case 'join_project':
      await handleJoinProject(ws, user, message.projectId)
      return
    case 'test_message':
      await handleTestMessage(ws, user, message.message)
      return
    case 'ping':
      send(ws, { type: 'pong' })
      return
    case 'join_file':
      await handleJoinFile(ws, user, message.projectId, message.fileId)
      return
    case 'leave_file':
      yjsRoomManager.leaveFile(ws)
      return
    default:
      sendError(ws, 'Unknown message type')
  }
}

async function handleJoinProject(ws: WebSocket, user: WsUser, projectId: unknown): Promise<void> {
  if (typeof projectId !== 'string' || !projectId) {
    sendError(ws, 'projectId is required')
    return
  }

  // Reuses the same ownership check the REST project endpoints use, so a
  // client can never join a room for a project it can't already GET.
  try {
    await projectService.getProjectById(projectId, user.id)
  } catch {
    sendError(ws, 'You do not have access to this project')
    return
  }

  const previousProjectId = connectionManager.joinRoom(ws, projectId)
  if (previousProjectId) {
    connectionManager.broadcastToRoom(previousProjectId, {
      type: 'user_left',
      userId: user.id,
      projectId: previousProjectId,
    })
  }

  connectionManager.broadcastToRoom(projectId, { type: 'user_joined', userId: user.id, projectId }, ws)
}

async function handleTestMessage(ws: WebSocket, user: WsUser, text: unknown): Promise<void> {
  const connection = connectionManager.getConnection(ws)
  if (!connection?.projectId) {
    sendError(ws, 'Join a project before sending messages')
    return
  }
  if (typeof text !== 'string' || !text.trim()) {
    sendError(ws, 'message is required')
    return
  }

  // Persisted first so the history a late joiner fetches over REST is never
  // behind what's already been broadcast live.
  await chatService.recordMessage(connection.projectId, user.id, text)

  connectionManager.broadcastToRoom(
    connection.projectId,
    { type: 'test_message', userId: user.id, userName: user.name, message: text },
    ws,
  )
}

async function handleJoinFile(ws: WebSocket, user: WsUser, projectId: unknown, fileId: unknown): Promise<void> {
  if (typeof projectId !== 'string' || !projectId || typeof fileId !== 'string' || !fileId) {
    sendError(ws, 'projectId and fileId are required')
    return
  }

  // Reuses the same file-access check the REST file endpoints use — a
  // client can never join a document room for a file it can't already GET.
  let file
  try {
    file = await fileService.getFileById(fileId, user.id)
  } catch {
    sendError(ws, 'You do not have access to this file')
    return
  }

  // Defensive: never trust the client's claimed projectId over the file's
  // actual owning project, even though the access check above already keyed
  // off the real file/project relationship.
  if (file.projectId !== projectId) {
    sendError(ws, 'File does not belong to the specified project')
    return
  }

  // A VIEWER can join to receive live updates, but the room must know not
  // to accept document mutations from this socket (see applyUpdateFromSocket).
  const role = await projectAuthorizationService.getProjectRole(user.id, projectId)
  const canEdit = projectAuthorizationService.canEditRole(role)

  const { syncMessage, awarenessMessage } = await yjsRoomManager.joinFile(
    ws,
    projectId,
    fileId,
    canEdit,
    async () => file.content,
  )
  if (ws.readyState === ws.OPEN) {
    ws.send(syncMessage)
    if (awarenessMessage) {
      ws.send(awarenessMessage)
    }
  }
}
