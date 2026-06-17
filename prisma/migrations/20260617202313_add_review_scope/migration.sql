-- CreateEnum
CREATE TYPE "ReviewScope" AS ENUM ('SHOW', 'SEASON', 'EPISODE');

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "episode_number" INTEGER,
ADD COLUMN     "scope" "ReviewScope" NOT NULL DEFAULT 'EPISODE',
ADD COLUMN     "season_number" INTEGER;
