-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
