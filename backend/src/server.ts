import 'dotenv/config'
import cors from 'cors'
import express from 'express'
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
app.use(express.json())

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

attachWebSocketServer(server)
