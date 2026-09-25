-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "project_access_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_access_requests_projectId_idx" ON "project_access_requests"("projectId");

-- CreateIndex
CREATE INDEX "project_access_requests_requesterId_idx" ON "project_access_requests"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "project_access_requests_projectId_requesterId_key" ON "project_access_requests"("projectId", "requesterId");

-- AddForeignKey
ALTER TABLE "project_access_requests" ADD CONSTRAINT "project_access_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_access_requests" ADD CONSTRAINT "project_access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
