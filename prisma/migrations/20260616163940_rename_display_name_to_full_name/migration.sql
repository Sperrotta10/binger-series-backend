/*
  Warnings:

  - You are about to drop the column `display_name` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "display_name",
ADD COLUMN     "full_name" VARCHAR(50);
