// One-off backfill for the Phase 9 ProjectMember table: every existing
// project gets an OWNER membership for its owner, and every already-APPROVED
// access request gets an EDITOR membership for the requester. Safe to run
// more than once (upserts).
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, ownerId: true } })
  for (const project of projects) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: project.ownerId } },
      create: { projectId: project.id, userId: project.ownerId, role: 'OWNER' },
      update: { role: 'OWNER' },
    })
  }
  console.log(`Backfilled OWNER membership for ${projects.length} project(s).`)

  const approvedRequests = await prisma.projectAccessRequest.findMany({
    where: { status: 'APPROVED' },
    select: { projectId: true, requesterId: true },
  })
  for (const request of approvedRequests) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: request.projectId, userId: request.requesterId } },
      create: { projectId: request.projectId, userId: request.requesterId, role: 'EDITOR' },
      update: {},
    })
  }
  console.log(`Backfilled EDITOR membership for ${approvedRequests.length} approved access request(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
