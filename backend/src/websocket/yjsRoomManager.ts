import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  modifyAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import * as Y from 'yjs'
import type { WebSocket } from 'ws'
import { colorForUser } from './awarenessColor'
import type { WsUser } from './types'

// Every binary WebSocket frame in the collaboration channel starts with one
// type byte so sync updates and awareness (cursor/selection) updates can
// share the same connection without a separate transport.
export const MESSAGE_SYNC = 0
export const MESSAGE_AWARENESS = 1

function frame(type: number, payload: Uint8Array): Uint8Array {
  const framed = new Uint8Array(payload.length + 1)
  framed[0] = type
  framed.set(payload, 1)
  return framed
}

type FileRoom = {
  doc: Y.Doc
  awareness: Awareness
  sockets: Set<WebSocket>
  // Which Yjs awareness clientIDs a given socket has introduced, so we can
  // mark them offline (and tell everyone else) when that socket disconnects.
  clientIdsBySocket: Map<WebSocket, Set<number>>
}

type SocketMembership = {
  roomKey: string
  // Whether this socket's user may mutate the document (OWNER/EDITOR) or
  // only observe it (VIEWER) — decided once at join time from the caller's
  // authorization check, since this module has no knowledge of projects/roles.
  canEdit: boolean
}

// Keyed by `project:{projectId}:file:{fileId}` — deterministic so every
// client editing the same file converges on the same in-memory Y.Doc.
// Kept alive for the life of the server process (not just while sockets are
// attached), so collaborative edits survive everyone briefly leaving; actual
// persistence to Postgres only happens via the explicit Save endpoint.
const fileRooms = new Map<string, FileRoom>()
// Room creation is async (it may need to load the file's DB content), so
// concurrent first-joiners share one in-flight creation instead of racing
// to create two different Y.Docs for the same file.
const roomCreation = new Map<string, Promise<FileRoom>>()
const socketMembership = new Map<WebSocket, SocketMembership>()

function roomKey(projectId: string, fileId: string): string {
  return `project:${projectId}:file:${fileId}`
}

async function getOrCreateRoom(key: string, loadInitialContent: () => Promise<string>): Promise<FileRoom> {
  const existing = fileRooms.get(key)
  if (existing) {
    return existing
  }

  let creation = roomCreation.get(key)
  if (!creation) {
    creation = (async () => {
      const doc = new Y.Doc()
      const content = await loadInitialContent()
      if (content) {
        doc.getText('content').insert(0, content)
      }
      const awareness = new Awareness(doc)
      // The server itself isn't a "user" — Awareness sets a local ({})
      // state for its own doc.clientID on construction; clear it so the
      // server never appears as a phantom collaborator.
      awareness.setLocalState(null)

      const room: FileRoom = { doc, awareness, sockets: new Set(), clientIdsBySocket: new Map() }
      fileRooms.set(key, room)
      return room
    })()
    roomCreation.set(key, creation)
  }

  const room = await creation
  roomCreation.delete(key)
  return room
}

type JoinResult = {
  syncMessage: Uint8Array
  awarenessMessage: Uint8Array | null
}

// Joins the file's room (leaving whatever file room this socket was
// previously in, if any), seeding the room's Y.Doc from `loadInitialContent`
// only the first time it's ever created. Returns the room's current full
// document state plus everyone else's current cursor/selection state, both
// already framed and ready to send to the joining client.
async function joinFile(
  ws: WebSocket,
  projectId: string,
  fileId: string,
  canEdit: boolean,
  loadInitialContent: () => Promise<string>,
): Promise<JoinResult> {
  leaveFile(ws)

  const key = roomKey(projectId, fileId)
  const room = await getOrCreateRoom(key, loadInitialContent)

  room.sockets.add(ws)
  socketMembership.set(ws, { roomKey: key, canEdit })

  const existingClientIds = Array.from(room.awareness.getStates().keys())
  const awarenessMessage =
    existingClientIds.length > 0 ? frame(MESSAGE_AWARENESS, encodeAwarenessUpdate(room.awareness, existingClientIds)) : null

  return {
    syncMessage: frame(MESSAGE_SYNC, Y.encodeStateAsUpdate(room.doc)),
    awarenessMessage,
  }
}

// Removes the socket from its current room and, if it had introduced any
// awareness (cursor) states, marks them offline and broadcasts that removal
// so their cursor disappears for everyone still in the room.
function leaveFile(ws: WebSocket): void {
  const membership = socketMembership.get(ws)
  if (!membership) return
  socketMembership.delete(ws)

  const room = fileRooms.get(membership.roomKey)
  if (!room) return
  room.sockets.delete(ws)

  const ownedClientIds = room.clientIdsBySocket.get(ws)
  room.clientIdsBySocket.delete(ws)
  if (!ownedClientIds || ownedClientIds.size === 0) return

  const ids = Array.from(ownedClientIds)
  removeAwarenessStates(room.awareness, ids, null)
  const removalMessage = frame(MESSAGE_AWARENESS, encodeAwarenessUpdate(room.awareness, ids))
  broadcast(room, removalMessage)
}

// Applies an incoming Yjs document update to the socket's current file room
// and relays the same bytes to every other socket in that room. A VIEWER's
// update is rejected outright — the server never blindly trusts/broadcasts
// a document mutation just because the socket is in the room; only sockets
// whose join-time role check granted edit access can mutate the doc at all.
// Returns whether the update was applied, so the caller can tell a rejected
// client why nothing happened.
function applyUpdateFromSocket(ws: WebSocket, update: Uint8Array): boolean {
  const membership = socketMembership.get(ws)
  if (!membership) return false
  if (!membership.canEdit) return false

  const room = fileRooms.get(membership.roomKey)
  if (!room) return false

  Y.applyUpdate(room.doc, update)
  broadcast(room, frame(MESSAGE_SYNC, update), ws)
  return true
}

// Applies an incoming awareness (cursor/selection) update, remembers which
// awareness clientIDs this socket now owns (so they can be cleared on
// disconnect), and relays the (identity-sanitized) bytes to the rest of the
// room.
function applyAwarenessFromSocket(ws: WebSocket, user: WsUser, update: Uint8Array): void {
  const room = roomForSocket(ws)
  if (!room) return

  // Never trust the identity a client embeds in its own awareness state —
  // rewrite it to the connection's actual authenticated user before this
  // update is applied or relayed to anyone else, so a client can't claim to
  // be someone else's name/id (color is likewise recomputed server-side so
  // it can't be spoofed to something confusing either).
  const sanitized = modifyAwarenessUpdate(update, (state) =>
    state === null ? null : { ...state, user: { id: user.id, name: user.name, color: colorForUser(user.id) } },
  )

  let changedIds: number[] = []
  const captureChange = (changes: { added: number[]; updated: number[]; removed: number[] }) => {
    changedIds = [...changes.added, ...changes.updated]
    if (changes.removed.length > 0) {
      const owned = room.clientIdsBySocket.get(ws)
      for (const id of changes.removed) owned?.delete(id)
    }
  }
  room.awareness.on('update', captureChange)
  applyAwarenessUpdate(room.awareness, sanitized, ws)
  room.awareness.off('update', captureChange)

  if (changedIds.length > 0) {
    let owned = room.clientIdsBySocket.get(ws)
    if (!owned) {
      owned = new Set()
      room.clientIdsBySocket.set(ws, owned)
    }
    for (const id of changedIds) owned.add(id)
  }

  broadcast(room, frame(MESSAGE_AWARENESS, sanitized), ws)
}

function roomForSocket(ws: WebSocket): FileRoom | undefined {
  const membership = socketMembership.get(ws)
  if (!membership) return undefined
  return fileRooms.get(membership.roomKey)
}

function broadcast(room: FileRoom, message: Uint8Array, excludeWs?: WebSocket): void {
  for (const socket of room.sockets) {
    if (socket === excludeWs) continue
    if (socket.readyState === socket.OPEN) {
      socket.send(message)
    }
  }
}

export const yjsRoomManager = {
  joinFile,
  leaveFile,
  applyUpdateFromSocket,
  applyAwarenessFromSocket,
}
