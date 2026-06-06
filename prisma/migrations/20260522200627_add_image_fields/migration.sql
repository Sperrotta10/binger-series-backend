-- AlterTable
ALTER TABLE "episodes" ADD COLUMN     "image_medium_url" TEXT,
ADD COLUMN     "image_url" TEXT;

-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "poster_medium_url" TEXT;

-- AlterTable
ALTER TABLE "series" ADD COLUMN     "poster_medium_url" TEXT;
