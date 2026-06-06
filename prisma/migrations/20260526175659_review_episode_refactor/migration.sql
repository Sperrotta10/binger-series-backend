-- DropIndex
DROP INDEX "reviews_series_id_season_id_idx";

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "episode_id" UUID;

-- CreateIndex
CREATE INDEX "reviews_series_id_season_id_episode_id_idx" ON "reviews"("series_id", "season_id", "episode_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
