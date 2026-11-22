-- Registrations now live in "Applications": one row per event and applier.
DROP TABLE "EventRegistration";

-- AlterTable
ALTER TABLE "Applications"
  DROP COLUMN "position",
  ADD COLUMN "eventId" TEXT NOT NULL,
  ADD COLUMN "additionalMessage" TEXT NOT NULL,
  ALTER COLUMN "companyName" DROP NOT NULL,
  ALTER COLUMN "companyEmail" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Applications_eventId_applicationDate_idx" ON "Applications"("eventId", "applicationDate");

-- CreateIndex
CREATE INDEX "Applications_applier_idx" ON "Applications"("applier");

-- CreateIndex
CREATE UNIQUE INDEX "Applications_eventId_applier_key" ON "Applications"("eventId", "applier");

-- AddForeignKey
ALTER TABLE "Applications" ADD CONSTRAINT "Applications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HackathonEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
