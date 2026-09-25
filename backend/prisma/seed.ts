import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_EMAIL = 'demo@collabcode.dev'
const DEMO_PASSWORD = 'password123'

async function main() {
  await prisma.file.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } })

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const owner = await prisma.user.create({
    data: { name: 'Demo User', email: DEMO_EMAIL, passwordHash },
  })

  const project = await prisma.project.create({
    data: { name: 'My Collaborative Project', ownerId: owner.id },
  })

  await prisma.projectMember.create({
    data: { projectId: project.id, userId: owner.id, role: 'OWNER' },
  })

  await prisma.file.createMany({
    data: [
      {
        projectId: project.id,
        name: 'App.tsx',
        path: 'src/App.tsx',
        language: 'typescript',
        content: `function App() {
  return (
    <div>
      <h1>Hello, CollabCode!</h1>
    </div>
  )
}

export default App
`,
      },
      {
        projectId: project.id,
        name: 'main.tsx',
        path: 'src/main.tsx',
        language: 'typescript',
        content: `import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
`,
      },
      {
        projectId: project.id,
        name: 'package.json',
        path: 'package.json',
        language: 'json',
        content: `{
  "name": "collab-code-editor",
  "version": "0.0.0",
  "private": true
}
`,
      },
      {
        projectId: project.id,
        name: 'README.md',
        path: 'README.md',
        language: 'markdown',
        content: `# CollabCode

A real-time collaborative code editor, built one phase at a time.
`,
      },
    ],
  })

  console.log(`Seeded user "${owner.email}" (password: ${DEMO_PASSWORD})`)
  console.log(`Seeded project "${project.name}" (${project.id}) with 4 files.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
