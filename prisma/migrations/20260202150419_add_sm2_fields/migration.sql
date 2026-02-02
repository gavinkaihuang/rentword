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
    "interval" REAL NOT NULL DEFAULT 0,
    "easinessFactor" REAL NOT NULL DEFAULT 2.5,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "UserProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserProgress" ("consecutiveCorrect", "id", "isUnfamiliar", "lastReviewed", "nextReviewDate", "proficiency", "userId", "wordId") SELECT "consecutiveCorrect", "id", "isUnfamiliar", "lastReviewed", "nextReviewDate", "proficiency", "userId", "wordId" FROM "UserProgress";
DROP TABLE "UserProgress";
ALTER TABLE "new_UserProgress" RENAME TO "UserProgress";
CREATE UNIQUE INDEX "UserProgress_userId_wordId_key" ON "UserProgress"("userId", "wordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
