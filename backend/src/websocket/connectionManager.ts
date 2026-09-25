import type { WebSocket } from 'ws'
import type { ServerMessage, WsUser } from './types'

type Connection = {
  ws: WebSocket
  user: WsUser
  projectId: string | null
}

const connections = new Map<WebSocket, Connection>()
const rooms = new Map<string, Set<WebSocket>>()
// Secondary index so an access-request notification can reach a specific
// user's socket(s) regardless of which project room (if any) they're in.
const socketsByUser = new Map<string, Set<WebSocket>>()

function addConnection(ws: WebSocket, user: WsUser): void {
  connections.set(ws, { ws, user, projectId: null })
  if (!socketsByUser.has(user.id)) {
    socketsByUser.set(user.id, new Set())
  }
  socketsByUser.get(user.id)?.add(ws)
}

function getConnection(ws: WebSocket): Connection | undefined {
  return connections.get(ws)
}

// Moves a socket into `projectId`'s room, leaving whatever room it was previously
// in (if any). Returns the previous room id so the caller can broadcast a
// user_left there, or null if the socket wasn't in a room.
function joinRoom(ws: WebSocket, projectId: string): string | null {
  const connection = connections.get(ws)
  if (!connection) {
    return null
  }

  const previousProjectId = connection.projectId
  if (previousProjectId === projectId) {
    return null
  }

  if (previousProjectId) {
    removeFromRoom(previousProjectId, ws)
  }

  connection.projectId = projectId
  if (!rooms.has(projectId)) {
    rooms.set(projectId, new Set())
  }
  rooms.get(projectId)?.add(ws)

  return previousProjectId
}

// Removes the socket entirely (on disconnect). Returns the connection that was
// removed so the caller can broadcast a user_left for its room, if any.
function removeConnection(ws: WebSocket): Connection | undefined {
  const connection = connections.get(ws)
  if (!connection) {
    return undefined
  }

  if (connection.projectId) {
    removeFromRoom(connection.projectId, ws)
  }
  connections.delete(ws)

  const userSockets = socketsByUser.get(connection.user.id)
  userSockets?.delete(ws)
  if (userSockets && userSockets.size === 0) {
    socketsByUser.delete(connection.user.id)
  }

  return connection
}

function removeFromRoom(projectId: string, ws: WebSocket): void {
  const room = rooms.get(projectId)
  if (!room) {
    return
  }
  room.delete(ws)
  if (room.size === 0) {
    rooms.delete(projectId)
  }
}

function broadcastToRoom(projectId: string, message: ServerMessage, excludeWs?: WebSocket): void {
  const room = rooms.get(projectId)
  if (!room) {
    return
  }

  const payload = JSON.stringify(message)
  for (const socket of room) {
    if (socket === excludeWs) {
      continue
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(payload)
    }
  }
}

function sendToUser(userId: string, message: ServerMessage): void {
  const sockets = socketsByUser.get(userId)
  if (!sockets) {
    return
  }

  const payload = JSON.stringify(message)
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload)
    }
  }
}

export const connectionManager = {
  addConnection,
  getConnection,
  joinRoom,
  removeConnection,
  broadcastToRoom,
  sendToUser,
}
