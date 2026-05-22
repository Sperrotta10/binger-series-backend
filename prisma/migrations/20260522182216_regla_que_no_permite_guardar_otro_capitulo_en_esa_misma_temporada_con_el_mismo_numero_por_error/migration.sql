/*
  Warnings:

  - A unique constraint covering the columns `[season_id,episode_number]` on the table `episodes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[series_id,season_number]` on the table `seasons` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "series" ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "episodes_season_id_episode_number_key" ON "episodes"("season_id", "episode_number");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_series_id_season_number_key" ON "seasons"("series_id", "season_number");
