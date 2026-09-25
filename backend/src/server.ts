import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { prisma } from './config/database'
import accessRequestRoutes from './routes/accessRequestRoutes'
import authRoutes from './routes/authRoutes'
import fileRoutes from './routes/fileRoutes'
import projectRoutes from './routes/projectRoutes'
import { errorHandler, notFoundHandler } from './utils/errorHandler'
import { attachWebSocketServer } from './websocket/websocketServer'

const app = express()

const PORT = process.env.PORT ?? 3000
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

app.use(cors({ origin: FRONTEND_URL }))
// Sized to comfortably exceed fileService's own MAX_CONTENT_BYTES (5MB) even
// after JSON-string escaping overhead, so a file that's actually too large
// fails validation there (clean 400 naming the real limit) instead of being
// rejected here first with a less specific error.
app.use(express.json({ limit: '10mb' }))

// Unauthenticated by design — deployment platforms (Render, etc.) poll this
// before routing traffic to an instance, so it must not require a token and
// must not reveal anything beyond "the process is up".
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/access-requests', accessRequestRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
})

const wss = attachWebSocketServer(server)

let shuttingDown = false

function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}, shutting down gracefully…`)

  server.close(() => {
    console.log('HTTP server closed')
  })

  for (const client of wss.clients) {
    client.close(1001, 'Server is shutting down')
  }
  wss.close()

  prisma
    .$disconnect()
    .catch((err) => console.error('Error disconnecting Prisma client', err))
    .finally(() => process.exit(0))

  // Safety net in case a stuck connection prevents the graceful path above
  // from ever calling process.exit.
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
