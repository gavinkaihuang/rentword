-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN "mistakeType" TEXT;

-- AlterTable
ALTER TABLE "Word" ADD COLUMN "affixes" TEXT;
ALTER TABLE "Word" ADD COLUMN "content" TEXT;
ALTER TABLE "Word" ADD COLUMN "history" TEXT;
ALTER TABLE "Word" ADD COLUMN "mnemonic" TEXT;
ALTER TABLE "Word" ADD COLUMN "roots" TEXT;
ALTER TABLE "Word" ADD COLUMN "story" TEXT;
ALTER TABLE "Word" ADD COLUMN "variations" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" DATETIME,
    "lastReviewed" DATETIME,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "isUnfamiliar" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "UserProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserProgress" ("consecutiveCorrect", "id", "lastReviewed", "nextReviewDate", "proficiency", "userId", "wordId") SELECT "consecutiveCorrect", "id", "lastReviewed", "nextReviewDate", "proficiency", "userId", "wordId" FROM "UserProgress";
DROP TABLE "UserProgress";
ALTER TABLE "new_UserProgress" RENAME TO "UserProgress";
CREATE UNIQUE INDEX "UserProgress_userId_wordId_key" ON "UserProgress"("userId", "wordId");
CREATE TABLE "new_WordBook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "displayMode" INTEGER NOT NULL DEFAULT 1
);
INSERT INTO "new_WordBook" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "WordBook";
DROP TABLE "WordBook";
ALTER TABLE "new_WordBook" RENAME TO "WordBook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
