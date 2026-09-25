import type { IncomingMessage, Server as HttpServer } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { userRepository } from '../repositories/userRepository'
import { verifyToken } from '../utils/jwt'
import { connectionManager } from './connectionManager'
import { handleClientMessage } from './messageHandler'
import type { WsUser } from './types'
import { MESSAGE_AWARENESS, MESSAGE_SYNC, yjsRoomManager } from './yjsRoomManager'

const WS_PATH = '/ws'

// Browsers can't set custom headers on the WebSocket handshake, so the JWT is
// passed as a query parameter instead of an Authorization header.
async function authenticateUpgrade(request: IncomingMessage): Promise<WsUser> {
  const url = new URL(request.url ?? '', 'http://localhost')
  const token = url.searchParams.get('token')
  if (!token) {
    throw new Error('Missing token')
  }

  const payload = verifyToken(token)
  const user = await userRepository.findById(payload.sub)
  if (!user) {
    throw new Error('User not found')
  }

  return { id: user.id, name: user.name, email: user.email }
}

export function attachWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = new URL(request.url ?? '', 'http://localhost')
    if (pathname !== WS_PATH) {
      socket.destroy()
      return
    }

    authenticateUpgrade(request)
      .then((user) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
          setupConnection(ws, user)
        })
      })
      .catch(() => {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
      })
  })

  return wss
}

// Handled directly from the handleUpgrade callback (rather than via the
// typed 'connection' event) since we need to carry the already-authenticated
// user alongside the socket, which doesn't fit the event's (ws, request) shape.
function setupConnection(ws: WebSocket, user: WsUser): void {
  connectionManager.addConnection(ws, user)
  ws.send(JSON.stringify({ type: 'connected', userId: user.id }))

  ws.on('message', (raw, isBinary) => {
    if (isBinary) {
      // Yjs traffic: routed by the socket's current file-room membership,
      // not parsed as JSON. The first byte says whether it's a document
      // sync update or a cursor/selection (awareness) update.
      const bytes = toUint8Array(raw)
      const payload = bytes.subarray(1)
      if (bytes[0] === MESSAGE_SYNC) {
        const accepted = yjsRoomManager.applyUpdateFromSocket(ws, payload)
        if (!accepted && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'You do not have permission to edit this file' }))
        }
      } else if (bytes[0] === MESSAGE_AWARENESS) {
        yjsRoomManager.applyAwarenessFromSocket(ws, user, payload)
      }
      return
    }

    handleClientMessage(ws, user, raw).catch(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }))
      }
    })
  })

  ws.on('close', () => {
    yjsRoomManager.leaveFile(ws)

    const connection = connectionManager.removeConnection(ws)
    if (connection?.projectId) {
      connectionManager.broadcastToRoom(connection.projectId, {
        type: 'user_left',
        userId: user.id,
        projectId: connection.projectId,
      })
    }
  })
}

function toUint8Array(raw: RawData): Uint8Array {
  if (Array.isArray(raw)) {
    return new Uint8Array(Buffer.concat(raw))
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw)
  }
  return new Uint8Array(raw)
}
