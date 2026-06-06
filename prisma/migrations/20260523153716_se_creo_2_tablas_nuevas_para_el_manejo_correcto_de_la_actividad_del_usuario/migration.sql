/*
  Warnings:

  - You are about to drop the column `watch_log_id` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the `watch_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SeriesStatus" AS ENUM ('WATCHING', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED', 'ON_HOLD');

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_watch_log_id_fkey";

-- DropForeignKey
ALTER TABLE "watch_logs" DROP CONSTRAINT "watch_logs_episode_id_fkey";

-- DropForeignKey
ALTER TABLE "watch_logs" DROP CONSTRAINT "watch_logs_user_id_fkey";

-- AlterTable
ALTER TABLE "reviews" DROP COLUMN "watch_log_id",
ADD COLUMN     "episode_progress_id" UUID;

-- DropTable
DROP TABLE "watch_logs";

-- CreateTable
CREATE TABLE "user_episode_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "episode_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "is_watched" BOOLEAN NOT NULL DEFAULT true,
    "rewatch_count" INTEGER NOT NULL DEFAULT 0,
    "watched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_episode_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_series_statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "status" "SeriesStatus" NOT NULL DEFAULT 'WATCHING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_series_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_episode_progress_user_id_series_id_idx" ON "user_episode_progress"("user_id", "series_id");

-- CreateIndex
CREATE INDEX "user_episode_progress_user_id_season_id_idx" ON "user_episode_progress"("user_id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_episode_progress_user_id_episode_id_key" ON "user_episode_progress"("user_id", "episode_id");

-- CreateIndex
CREATE INDEX "user_series_statuses_user_id_status_idx" ON "user_series_statuses"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_series_statuses_user_id_series_id_key" ON "user_series_statuses"("user_id", "series_id");

-- AddForeignKey
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_series_statuses" ADD CONSTRAINT "user_series_statuses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_series_statuses" ADD CONSTRAINT "user_series_statuses_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_episode_progress_id_fkey" FOREIGN KEY ("episode_progress_id") REFERENCES "user_episode_progress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
