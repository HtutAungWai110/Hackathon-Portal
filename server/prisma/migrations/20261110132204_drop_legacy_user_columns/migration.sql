/*
  Warnings:

  - You are about to drop the column `lockoutUntil` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `login_fail_attempts` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "lockoutUntil",
DROP COLUMN "login_fail_attempts",
DROP COLUMN "password",
DROP COLUMN "username";
